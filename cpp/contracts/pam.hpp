#pragma once

#include <eosio/crypto.hpp>
#include <eosio/singleton.hpp>

#include "utils.hpp"
#include "metadata.hpp"
#include "operation.hpp"

namespace eosio {
    using bytes = std::vector<uint8_t>;
    namespace pam {
        const public_key NULL_PUBLIC_KEY = public_key();

        const bytes CHAIN_ID = {
            0xac, 0xa3, 0x76, 0xf2, 0x06, 0xb8, 0xfc, 0x25,
            0xa6, 0xed, 0x44, 0xdb, 0xdc, 0x66, 0x54, 0x7c,
            0x36, 0xc6, 0xc3, 0x3e, 0x3a, 0x11, 0x9f, 0xfb,
            0xea, 0xef, 0x94, 0x36, 0x42, 0xf0, 0xe9, 0x06
        };

        TABLE mappings {
            bytes chain_id;
            bytes emitter;
            bytes topic_zero;

            uint64_t primary_key() const {
            eosio::check(chain_id.size() == 32, "Chain ID must be 32 bytes long.");
            return (static_cast<uint64_t>(chain_id[24]) << 56) |
                (static_cast<uint64_t>(chain_id[25]) << 48) |
                (static_cast<uint64_t>(chain_id[26]) << 40) |
                (static_cast<uint64_t>(chain_id[27]) << 32) |
                (static_cast<uint64_t>(chain_id[28]) << 24) |
                (static_cast<uint64_t>(chain_id[29]) << 16) |
                (static_cast<uint64_t>(chain_id[30]) << 8)  |
                (static_cast<uint64_t>(chain_id[31]));
            }
        };

        TABLE tee {
            public_key key;
            bytes attestation;
        };

        using tee_pubkey = singleton<"tee"_n, tee>;
        typedef eosio::multi_index<"mappings"_n, mappings> mappings_table;

        tee null_key = {
            .key = NULL_PUBLIC_KEY,
            .attestation = {},
        };

        void check_authorization(name adapter, const operation& operation, const metadata& metadata, checksum256 event_id);

        bool context_checks(const operation& operation, const metadata& metadata) {
            uint8_t offset = 2; // Skip protocol, version
            bytes origin_chain_id = extract_32bytes(metadata.preimage, offset);

            if (origin_chain_id != operation.originChainId) {
                return false;
            }

            offset += 32;
            bytes block_id = extract_32bytes(metadata.preimage, offset);

            offset += 32;
            bytes tx_id = extract_32bytes(metadata.preimage, offset);

            if (block_id != operation.blockId || tx_id != operation.txId) {
                return false;
            }

            return true;
        }

        void check_authorization(name adapter, const operation& operation, const metadata& metadata, checksum256& event_id) {
            check(context_checks(operation, metadata), "unexpected context");

            tee_pubkey _tee_pubkey(adapter, adapter.value);
            public_key tee_key = _tee_pubkey.get().key;

            uint128_t offset = 2;
            bytes origin_chain_id = extract_32bytes(metadata.preimage, offset);
            mappings_table _mappings_table(adapter, adapter.value);
            auto itr_mappings = _mappings_table.find(get_mappings_key(origin_chain_id));
            check(itr_mappings != _mappings_table.end(), "origin chain_id not registered");
            bytes exp_emitter = itr_mappings->emitter;
            bytes exp_topic_zero =  itr_mappings->topic_zero;

            event_id = sha256((const char*)metadata.preimage.data(), metadata.preimage.size());


            signature sig = convert_bytes_to_signature(metadata.signature);
            public_key recovered_pubkey = recover_key(event_id, sig);
            check(recovered_pubkey == tee_key, "invalid signature");

            offset = 0;
            bytes event_payload(metadata.preimage.begin() + 98, metadata.preimage.end());
            bytes emitter = extract_32bytes(event_payload, offset);
            check(emitter == exp_emitter && !is_all_zeros(emitter), "unexpected emitter");
            offset += 32;

            bytes topic_zero = extract_32bytes(event_payload, offset);
            check(topic_zero == exp_topic_zero && !is_all_zeros(topic_zero), "unexpected topic zero");
            offset += 32 * 4; // skip other topics

            // check nonce
            bytes event_data(event_payload.begin() + offset, event_payload.end());
            offset = 0;
            bytes nonce = extract_32bytes(event_data, offset);
            uint64_t nonce_int = bytes32_to_uint64(nonce);

            check(operation.nonce == nonce_int, "nonce do not match");
            offset += 32;

            // check origin token
            bytes token = extract_32bytes(event_data, offset);
            checksum256 token_hash = bytes32_to_checksum256(token);
            check(operation.token == token_hash, "token address do not match");
            offset += 32;

            // check destination chain id
            bytes dest_chain_id = extract_32bytes(event_data, offset);
            check(operation.destinationChainId == dest_chain_id, "destination chain id does not match with the expected one");
            check(CHAIN_ID == dest_chain_id, "destination chain id does not match with the current chain");
            offset += 32;

            // check amount
            bytes amount = extract_32bytes(event_data, offset);
            uint128_t amount_num = bytes32_to_uint128(amount);
            check(operation.amount == amount_num, "amount do not match");
            offset += 32;

            // check sender address
            bytes sender = extract_32bytes(event_data, offset);
            check(operation.sender == sender, "sender do not match");
            offset += 32;

            // check recipient address
            bytes recipient_len = extract_32bytes(event_data, offset);
            offset += 32;
            uint128_t recipient_len_num = bytes32_to_uint128(recipient_len);
            const uint128_t UINT128_MAX = (uint128_t)-1;
            check(recipient_len_num <= UINT128_MAX - offset, "overflow detected in data field");
            bytes recipient(event_data.begin() + offset, event_data.begin() + offset + recipient_len_num);
            name recipient_name = bytes_to_name(recipient);
            check(operation.recipient == recipient_name, "recipient do not match");
            offset += recipient_len_num;

            bytes user_data(event_data.begin() + offset, event_data.end());
            checksum256 data256 = sha256((const char*)user_data.data(), user_data.size());
            checksum256 op_data256 = sha256((const char*)operation.data.data(), operation.data.size());
            check(data256 == op_data256, "user data do not match");
        }
   };
}