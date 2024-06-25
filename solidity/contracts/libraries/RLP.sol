// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity >=0.8.0;

library RLP {
    function encode(
        address erc20,
        address sender,
        string memory recipient,
        bytes32 originChainId,
        bytes32 destinationChainId,
        bytes32 amount,
        bytes memory data
    ) internal pure returns (bytes memory rlpEncodedBytes) {
        bytes memory erc20Bytes = encodeAddress(erc20); // length 21
        bytes memory senderBytes = encodeAddress(sender); // length 21
        bytes memory recipientBytes = encodeData(bytes(recipient)); // var length
        bytes memory originChainIdBytes = encodeBytes32(originChainId); // length 33
        bytes memory destinationChainIdBytes = encodeBytes32(
            destinationChainId
        ); // length 33
        bytes memory amountBytes = encodeBytes32(amount); // length 33
        bytes memory encodedDataBytes = encodeData(data); // var length

        // NOTE: Size lowerbound is 156 bytes
        // (meaning more then 55 bytes, see RLP encoding)
        uint totalLength = erc20Bytes.length +
            senderBytes.length +
            recipientBytes.length +
            originChainIdBytes.length +
            destinationChainIdBytes.length +
            amountBytes.length +
            encodedDataBytes.length;

        // Binary representation of the total length
        // expect [0x11, 0x22, 0x33]
        bytes memory bl = abi.encodePacked(totalLength);

        require(bl.length < 65, "RLP binary length input too long!");

        uint256 rlpItemLength = totalLength + bl.length;
        rlpEncodedBytes = new bytes(rlpItemLength);

        // RLP encoding
        rlpEncodedBytes[0] = bytes1(uint8(0xf7 + bl.length));

        uint256 offset = 1;

        for (uint8 i = 0; i < bl.length; i++) {
            rlpEncodedBytes[offset + i] = bl[i];
        }

        offset += bl.length;

        for (uint8 i = 0; i < 21; i++) {
            rlpEncodedBytes[offset + i] = bytes1(erc20Bytes[i]);
            rlpEncodedBytes[offset + 21 + i] = bytes1(senderBytes[i]);
        }

        offset += 42; // 21 * 2

        for (uint256 i = 0; i < recipientBytes.length; i++) {
            rlpEncodedBytes[offset + i] = recipientBytes[i];
        }

        offset += recipientBytes.length;

        for (uint8 i = 0; i < 33; i++) {
            rlpEncodedBytes[offset + i] = bytes1(originChainIdBytes[i]);
            rlpEncodedBytes[offset + 33 + i] = bytes1(
                destinationChainIdBytes[i]
            );
            rlpEncodedBytes[offset + 66 + i] = bytes1(amountBytes[i]);
        }
    }

    function encodeBytes32(
        bytes32 b
    ) internal pure returns (bytes memory encodedBytes32) {
        encodedBytes32 = new bytes(33);
        encodedBytes32[0] = 0xa0;
        uint8 offset = 1;
        for (uint8 i = 0; i < 32; i++) {
            encodedBytes32[offset + i] = b[i];
        }
    }

    function encodeAddress(
        address a
    ) internal pure returns (bytes memory encodedAddress) {
        bytes20 addressBytes = bytes20(a);
        encodedAddress = new bytes(33);
        encodedAddress[0] = 0xa8;
        uint8 offset = 1;
        for (uint8 i = 0; i < 32; i++) {
            encodedAddress[offset + i] = addressBytes[i];
        }
    }

    function encodeData(
        bytes memory data
    ) internal pure returns (bytes memory encodedData) {
        require(data.length < type(uint64).max, "Invalid data length");

        if (data.length == 0) {
            encodedData = new bytes(1);
            encodedData[0] = 0x80;
        }

        if (data.length == 1 && data[0] < 0x80) {
            encodedData = data;
        }

        if (data.length < 56) {
            encodedData = new bytes(1 + data.length);
            uint8 offset = 1;
            for (uint8 i = 0; i < encodedData.length; i++) {
                encodedData[offset + i] = data[i];
            }
        } else {
            bytes memory bl = abi.encodePacked(data.length);
            require(bl.length < 65, "RLP data length too long!");
            encodedData = new bytes(1 + bl.length + data.length);

            encodedData[0] = bytes1(uint8(0xb7 + bl.length));
            uint256 offset = 1;
            for (uint8 i = 0; i < bl.length; i++) {
                encodedData[offset + i] = bl[i];
            }

            offset += bl.length;

            for (uint256 i = 0; i < data.length; i++) {
                encodedData[offset + i] = data[i];
            }
        }
    }
}
