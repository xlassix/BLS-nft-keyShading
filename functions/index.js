const functions = require("firebase-functions");
const web3 = require("web3");
const {
  initializeApp,
  applicationDefault,
  cert,
} = require("firebase-admin/app");
const {
  getFirestore,
  Timestamp,
  FieldValue,
} = require("firebase-admin/firestore");
const {
  getBalance,
  getKeyShades,
  recoverKey,
  randSelect,
} = require("./helper");
const provider = "https://rpc.ankr.com/fantom_testnet";
const web3client = new web3(new web3.providers.HttpProvider(provider));
const lightHouseNFT = "0x219624332F3c53d47817b9c83Da67C0A53a4c285";
const testWalletAddress = "0x9a40b8EE3B8Fe7eB621cd142a651560Fa7dF7CBa";
const serviceAccount = require("./fragmynt-8937d-firebase-adminsdk-quzji-2b953a764d.json");
const nodeNameList = ["node2", "node3", "node4", "node5"];

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();


//test key generation 
exports.generateKeys = functions.https.onRequest(async (request, response) => {
  const { keyShades, idData } = await getKeyShades(
    "5e21291448898a8f1f2dea3086b039fbdc3403468d23c0eea0c3dd6dafbada3f"
  );

  let recoveryKey = await recoverKey(keyShades.slice(0, 3), idData.slice(0, 3));

  response.json({
    message: "keyArrays",
    keyShades,
    idData,
    recoveryKey,
  });
});

exports.saveKey = functions.https.onRequest(async (request, response) => {
  //Todo: tokenAddress minTokenBalance
  const { CID, privateKey, tokenAddress, minTokenBalance } = request.body;
  if (!CID || !privateKey) {
    return response.status(400).json({ message: "missing data" });
  }
  const { keyShades, idData } = await getKeyShades(privateKey);
  const config = {
    tokenAddress,
    minimumToken: minTokenBalance,
    key: keyShades[0],
    index: idData[0],
  };
  const res = await Promise.all([
    ...nodeNameList.map((value, index) =>
      db
        .collection(value)
        .doc(CID)
        .set({ key: keyShades[index+1], index: idData[index+1] })
    ),
    db.collection("control").doc(CID).set(config),
  ]);
  response.json(res);
});

exports.getKey = functions.https.onRequest(async (request, response) => {
  const keys = [];
  const ids = [];
  let balance = 0;
  //Todo: sender address,
  const { CID, address, timestamp } = request.body;
  if (!CID || !address || !timestamp) {
    return response.status(400).json({ message: "missing data" });
  }

  const doc = await db.collection("control").doc(CID).get();
  if (!doc.exists) {
    return response.status(400).end();
  }
  const data = doc.data();
  try {
    balance = await getBalance(web3client, data.tokenAddress, address);
  } catch (e) {
    return response.status(400).json({ message: e.message });
  }
  if (parseInt(balance) < parseInt(data.minimumToken)) {
    return response.json({ message: "Insufficient Access" });
  } else {
    keys.push(data.key);
    ids.push(data.index);
  }
  const nodeIndexSelected = randSelect(2, 4);
  let nodeData = await Promise.all(
    nodeIndexSelected.map((e) => db.collection(nodeNameList[e]).doc(CID).get())
  );
  nodeData.map((e) => {
    let _data = e.data();
    keys.push(_data.key);
    ids.push(_data.index);
    return _data;
  });
  const recoveryKey = await recoverKey(keys, ids);
  response.json({ recoveryKey });
});
