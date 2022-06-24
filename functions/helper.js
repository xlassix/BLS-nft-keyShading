const bls = require("bls-eth-wasm");
const k = 3;
const n = 5;
const minABI = [
  {
    constant: true,

    inputs: [{ name: "_owner", type: "address" }],

    name: "balanceOf",

    outputs: [{ name: "balance", type: "uint256" }],

    type: "function",
  },
];

module.exports.getBalance = async (client, contractAddress, walletAddress) => {
  const contract = new client.eth.Contract(minABI, contractAddress);
  const result = await contract.methods.balanceOf(walletAddress).call();
  return result;
};

module.exports.getKeyShades = async (secKey) => {
  let msk = [];
  let idVec = [];
  let secVec = [];
  let pubVec = [];
  let sigVec = [];

  await bls.init(bls.BLS12_381);

  /*
  setup master secret key
  */
  let masterKey = new bls.SecretKey();
  masterKey.deserializeHexStr(secKey);
  msk.push(masterKey);
  for (let i = 0; i < k - 1; i++) {
    let sk = new bls.SecretKey();
    sk.setByCSPRNG();
    msk.push(sk);
  }

  /*
  key sharing
*/
  for (let i = 0; i < n; i++) {
    let id = new bls.Id();
    id.setByCSPRNG();
    idVec.push(id);
    let sk = new bls.SecretKey();
    sk.share(msk, idVec[i]);
    secVec.push(sk);
  }

  var secData = secVec.map((sk) => sk.serializeToHexStr());
  var idData = idVec.map((id) => id.serializeToHexStr());
  return { keyShades: secData, idData: idData };
};

module.exports.recoverKey = async (keyShades, ids) => {
  let idVec = [];
  let secVec = [];
  await bls.init(bls.BLS12_381);
  for (let i = 0; i < keyShades.length; i++) {
    let sk = new bls.SecretKey();
    sk.deserializeHexStr(keyShades[i]);
    secVec.push(sk);

    let id = new bls.Id();
    id.deserializeHexStr(ids[i]);
    idVec.push(id);
  }
  console.log(keyShades, ids);
  const sec = new bls.SecretKey();
  sec.recover(secVec, idVec);
  let s = sec.serializeToHexStr();
  return s;
};

function randRange(min, max) {
  return min + Math.floor(Math.random() * (max - min));
}
module.exports.randSelect = (k, n) => {
  const a = [];
  let prev = -1;
  for (let i = 0; i < k; i++) {
    let v = randRange(prev + 1, n - (k - i) + 1);
    a.push(v);
    prev = v;
  }
  return a;
};
