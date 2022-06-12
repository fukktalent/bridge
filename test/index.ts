import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import { ERC20PresetMinterPauser, Bridge, ERC20PresetMinterPauser__factory, Bridge__factory } from "../typechain-types";

describe("Bridge", function () {
    const ETH_CHAIN_ID = 1;
    const BNB_CHAIN_ID = 56;
    const SWAP_AMOUNT = 1_000;

    let owner: SignerWithAddress;
    let acc1: SignerWithAddress;
    let acc2: SignerWithAddress;
    let validator: SignerWithAddress;

    let erc20Eth: ERC20PresetMinterPauser;
    let erc20Bnb: ERC20PresetMinterPauser;

    let bridgeEth: Bridge;
    let bridgeBnb: Bridge;

    let nonce = 0;

    before(async function() {
        [owner, acc1, acc2, validator] = await ethers.getSigners();

        erc20Eth = await new ERC20PresetMinterPauser__factory(owner).deploy("test", "TST");
        await erc20Eth.deployed()

        erc20Bnb = await new ERC20PresetMinterPauser__factory(owner).deploy("test", "TST");
        await erc20Bnb.deployed()

        bridgeEth = await new Bridge__factory(owner).deploy(
            erc20Eth.address,
            ETH_CHAIN_ID,
            BNB_CHAIN_ID,
            owner.address
        );
        await bridgeEth.deployed();

        bridgeBnb = await new Bridge__factory(owner).deploy(
            erc20Bnb.address,
            BNB_CHAIN_ID,
            ETH_CHAIN_ID,
            owner.address
        );
        await bridgeBnb.deployed();

        erc20Eth.mint(acc1.address, SWAP_AMOUNT);

        await erc20Eth.connect(acc1).approve(bridgeEth.address, ethers.constants.MaxUint256);
        await erc20Bnb.connect(acc2).approve(bridgeBnb.address, ethers.constants.MaxUint256);

        await erc20Eth.grantRole(await erc20Eth.MINTER_ROLE(), bridgeEth.address);
        await erc20Bnb.grantRole(await erc20Bnb.MINTER_ROLE(), bridgeBnb.address);
    });

    it("Should set correct validator", async function () {
        await bridgeEth.setValidator(validator.address);
        expect(await bridgeEth.validator()).to.be.equal(validator.address);

        await bridgeBnb.setValidator(validator.address);
        expect(await bridgeBnb.validator()).to.be.equal(validator.address);
    });

    it("Should not set validator and revert ownable error", async function () {
        const tx = bridgeEth.connect(acc1).setValidator(acc1.address);
        await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");;
    });

    it("shoould init swap: burn tokens and emit swap event", async function () {
        const tx = await bridgeEth.connect(acc1).swap(acc2.address, SWAP_AMOUNT, nonce);

        expect(await erc20Eth.balanceOf(acc1.address)).to.be.equal(0);
        
        await expect(tx).to.emit(
            bridgeEth,
            "SwapInitialized"
        ).withArgs(
            acc1.address,
            acc2.address,
            ETH_CHAIN_ID,
            BNB_CHAIN_ID,
            SWAP_AMOUNT,
            nonce
        );
    });

    it("shoould revert redeem when invalid signer", async function () {
        const message = ethers.utils.solidityKeccak256(
            ["address", "address", "uint256", "uint256", "uint128", "uint256"],
            [acc1.address, acc2.address, ETH_CHAIN_ID, BNB_CHAIN_ID, SWAP_AMOUNT, nonce]
        );
        const signature = await acc2.signMessage(ethers.utils.arrayify(message));
        const { v, r, s } = ethers.utils.splitSignature(signature);

        const tx = bridgeBnb.connect(acc2).redeem(acc1.address, SWAP_AMOUNT, nonce, v, r, s);
        await expect(tx).to.be.revertedWith("InvalidSignature()");
    });

    it("shoould revert redeem when invalid caller", async function () {
        const message = ethers.utils.solidityKeccak256(
            ["address", "address", "uint256", "uint256", "uint128", "uint256"],
            [acc1.address, acc2.address, ETH_CHAIN_ID, BNB_CHAIN_ID, SWAP_AMOUNT, nonce]
        );
        const signature = await validator.signMessage(ethers.utils.arrayify(message));
        const { v, r, s } = ethers.utils.splitSignature(signature);

        const tx = bridgeBnb.connect(acc1).redeem(acc1.address, SWAP_AMOUNT, nonce, v, r, s);
        await expect(tx).to.be.revertedWith("InvalidSignature()");
    });

    it("shoould revert redeem when invalid signature", async function () {
        const message = ethers.utils.solidityKeccak256(
            ["address", "address", "uint256", "uint256", "uint128", "uint256"],
            [acc1.address, acc2.address, ETH_CHAIN_ID, BNB_CHAIN_ID, SWAP_AMOUNT, nonce + 1]
        );
        const signature = await validator.signMessage(ethers.utils.arrayify(message));
        const { v, r, s } = ethers.utils.splitSignature(signature);

        const tx = bridgeBnb.connect(acc2).redeem(acc1.address, SWAP_AMOUNT, nonce, v, r, s);
        await expect(tx).to.be.revertedWith("InvalidSignature()");
    });

    it("should redeem: mint tokens to user and emit event", async function () {
        const message = ethers.utils.solidityKeccak256(
            ["address", "address", "uint256", "uint256", "uint128", "uint256"],
            [acc1.address, acc2.address, ETH_CHAIN_ID, BNB_CHAIN_ID, SWAP_AMOUNT, nonce]
        );
        const signature = await validator.signMessage(ethers.utils.arrayify(message));
        const { v, r, s } = ethers.utils.splitSignature(signature);

        const tx = await bridgeBnb.connect(acc2).redeem(acc1.address, SWAP_AMOUNT, nonce, v, r, s);
        
        expect(await erc20Bnb.balanceOf(acc2.address)).to.be.equal(SWAP_AMOUNT);
        
        await expect(tx).to.emit(
            bridgeBnb,
            "Redeemed"
        ).withArgs(
            acc1.address,
            acc2.address,
            ETH_CHAIN_ID,
            BNB_CHAIN_ID,
            SWAP_AMOUNT,
            nonce
        );
    });

    it("shoould revert redeem when already redeemed", async function () {
        const message = ethers.utils.solidityKeccak256(
            ["address", "address", "uint256", "uint256", "uint128", "uint256"],
            [acc1.address, acc2.address, ETH_CHAIN_ID, BNB_CHAIN_ID, SWAP_AMOUNT, nonce]
        );
        const signature = await validator.signMessage(ethers.utils.arrayify(message));
        const { v, r, s } = ethers.utils.splitSignature(signature);

        const tx = bridgeBnb.connect(acc2).redeem(acc1.address, SWAP_AMOUNT, nonce, v, r, s);
        await expect(tx).to.be.revertedWith("AlreadyRedeemed()");
    });
});
