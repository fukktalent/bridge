//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Bridge is Ownable {
    using ECDSA for bytes32;

    ERC20PresetMinterPauser private _token;

    mapping(bytes32 => bool) private _isCompleted;

    uint256 private _chainId;
    uint256 private _swapChainId;

    address private _validator;

    event SwapInitialized(
        address from,
        address to,
        uint256 chainFrom,
        uint256 chainTo,
        uint128 amount,
        uint256 nonce
    );

    event Redeemed(
        address from,
        address to,
        uint256 chainFrom,
        uint256 chainTo,
        uint128 amount,
        uint256 nonce
    );

    error InvalidSignature();
    error AlreadyRedeemed();

    constructor(
        ERC20PresetMinterPauser token,
        uint256 chainId,
        uint256 swapChainId,
        address validator_
    ) {
        _token = token;
        _chainId = chainId;
        _swapChainId = swapChainId;
        _validator = validator_;
    }

    function swap(
        address to,
        uint128 amount,
        uint256 nonce
    ) external {
        _token.burnFrom(msg.sender, amount);
        emit SwapInitialized(
            msg.sender,
            to,
            _chainId,
            _swapChainId,
            amount,
            nonce
        );
    }

    function redeem(
        address from,
        uint128 amount,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                from,
                msg.sender,
                _swapChainId,
                _chainId,
                amount,
                nonce
            )
        );

        bytes32 hash = messageHash.toEthSignedMessageHash();

        if (hash.recover(v, r, s) != _validator) revert InvalidSignature();
        if (_isCompleted[hash] == true) revert AlreadyRedeemed();

        _isCompleted[hash] = true;
        _token.mint(msg.sender, amount);

        emit Redeemed(
            from,
            msg.sender,
            _swapChainId,
            _chainId,
            amount,
            nonce
        );
    }

    function setValidator(address validator_) external onlyOwner {
        _validator = validator_;
    }

    function validator() external view returns(address) {
        return _validator;
    }
}
