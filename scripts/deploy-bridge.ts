import * as dotenv from "dotenv";

import { ethers } from "hardhat";

dotenv.config();

async function main() {
    const Bridge = await ethers.getContractFactory("Bridge");
    const bridge = await Bridge.deploy(
        process.env.ERC20_ADDRESS || "0xEE6e0664C3A344EdaC2761DcE2A730e2e345b01d",
        process.env.CHAIN_ID || "97",
        process.env.SWAP_CHAIN_ID || "4",
        process.env.VALIDATOR_ADDRESS || "0x7BEb0f72845F4248d299A4d11E42724ceAc27aE1"
    );

    await bridge.deployed();

    console.log("Marketplace contract deployed to:", bridge.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
