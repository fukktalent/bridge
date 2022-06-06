import { task } from 'hardhat/config'
import { Bridge } from '../typechain-types';

task("swap", "init swap")
    .addParam("contract", "address of bridge")
    .addParam("to", "address to swap")
    .addParam("amount", "amount of tokens")
    .addParam("nonce", "nonce")
    .setAction(async (args, { ethers }) => {
        const { contract, to, amount, nonce } = args;
        const [signer] = await ethers.getSigners();

        const bridge: Bridge = <Bridge>(await ethers.getContractAt("Bridge", contract, signer));
        let tx = await bridge.swap(to, amount, nonce);

        console.log(tx);
    });

task("redeem", "init swap")
    .addParam("contract", "address of bridge")
    .addParam("from", "address from swap")
    .addParam("amount", "amount of tokens")
    .addParam("nonce", "nonce")
    .addParam("signature", "signature")
    .setAction(async (args, { ethers }) => {
        const { contract, from, amount, nonce, signature } = args;
        const { v, r, s } = signature;
        const [signer] = await ethers.getSigners();

        const bridge: Bridge = <Bridge>(await ethers.getContractAt("Bridge", contract, signer));
        let tx = await bridge.redeem(from, amount, nonce, v, r, s);

        console.log(tx);
    });

task("get-signature", "generate signature")
    .addParam("from", "address to swap")
    .addParam("to", "address from swap")
    .addParam("chainFrom", "chain id from swap")
    .addParam("chainTo", "chain id to swap")
    .addParam("amount", "amount of tokens")
    .addParam("nonce", "nonce")
    .setAction(async (args, { ethers }) => {
        const { from, to, chainFrom, chainTo, amount, nonce } = args;
        const [signer] = await ethers.getSigners();

        const message = ethers.utils.solidityKeccak256(
            ["address", "address", "uint256", "uint256", "uint128", "uint256"],
            [from, to, chainFrom, chainTo, amount, nonce]
        );
        const signature = await signer.signMessage(ethers.utils.arrayify(message));

        console.log("signature ", signature);
    });