import { ethers } from "ethers";
import * as kanaria from "./abi/kanaria";
import * as kanariaNew from "./abi/kanariaNew";
import * as rmrk from "./abi/rmrk";

export const CHAIN_NODE = "wss://wss.api.moonriver.moonbeam.network";
export const HTTPS_CHAIN_NODE = "https://moonriver.blastapi.io/85537306-e2b1-48a5-8842-58940c31b184";

// work well locally but not work well on subsquid cloud, so just leave it here for future use
export const FOR_FREQUENT_RPC_INVOKE_NODE = "wss://moonriver.blastapi.io/85537306-e2b1-48a5-8842-58940c31b184";

const oldLandSaleContractAddr = "0x98AF019Cdf16990130CBA555861046B02e9898cC";
const newLandSaleContractAddr = "0x913a3E067a559Ba24A7a06a6CDEa4837EEEAF72d";
const xcRMRKContractAddr = "0xffffffFF893264794d9d57E1E0E21E0042aF5A0A";

export const contractKanaria = new ethers.Contract(
  oldLandSaleContractAddr.toLowerCase(),
  kanaria.abi,
  new ethers.providers.WebSocketProvider(CHAIN_NODE)
);

// Note: https://twitter.com/SkybreachNFT/status/1545541419334606848
// The Land Sale Contract will migrate to new Contract on `11th July 2022 16:00 CET`

export const contractKanariaNew = new ethers.Contract(
  newLandSaleContractAddr.toLowerCase(),
  kanariaNew.abi,
  new ethers.providers.WebSocketProvider(CHAIN_NODE)
);

const httpsProvider = new ethers.providers.JsonRpcProvider(HTTPS_CHAIN_NODE);

export const contractKanariaNewForRPC = new ethers.Contract(
  newLandSaleContractAddr.toLowerCase(),
  kanariaNew.abi,
  httpsProvider
);

export const contractRMRK = new ethers.Contract(
  xcRMRKContractAddr.toLowerCase(),
  rmrk.abi,
  new ethers.providers.WebSocketProvider(CHAIN_NODE)
);
