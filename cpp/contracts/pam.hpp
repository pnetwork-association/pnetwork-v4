#pragma once

#include <eosio/crypto.hpp>
#include <eosio/singleton.hpp>

#include "utils.hpp"
#include "metadata.hpp"
#include "operation.hpp"

namespace eosio {
    using bytes = std::vector<uint8_t>;
    namespace pam {

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

        TABLE local_chain_id {
            bytes chain_id;
        };

        TABLE tee {
            public_key key;
            public_key updating_key;
            bytes attestation;
            bytes updating_attestation;
            uint64_t change_grace_threshold = 0;
        };

        using chain_id = singleton<"chainid"_n, local_chain_id>;
        using tee_pubkey = singleton<"tee"_n, tee>;
        typedef eosio::multi_index<"mappings"_n, mappings> mappings_table;

        static constexpr uint64_t TEE_ADDRESS_CHANGE_GRACE_PERIOD = 172800; // 48 hours

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
            //  Metadata preimage format:
            //    | version | protocol | origin | blockHash | txHash | eventPayload |
            //    |   1B    |    1B    |   32B  |    32B    |   32B  |    varlen    |
            //    +----------- context ---------+------------- event ---------------+
            check(context_checks(operation, metadata), "unexpected context");

            chain_id _chain_id(adapter, adapter.value);
            check(_chain_id.exists(), "local chain id singleton not set");
            bytes local_chain_id = _chain_id.get().chain_id;

            tee_pubkey _tee_pubkey(adapter, adapter.value);
            check(_tee_pubkey.exists(), "tee singleton not set");
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

            // Event payload format
            // |  emitter  |    topic-0     |    topics-1     |    topics-2     |    topics-3     |  eventBytes  |
            // |    32B    |      32B       |       32B       |       32B       |       32B       |    varlen    |
            offset = 0;
            bytes event_payload(metadata.preimage.begin() + 98, metadata.preimage.end());
            bytes emitter = extract_32bytes(event_payload, offset);
            check(emitter == exp_emitter && !is_all_zeros(emitter), "unexpected emitter");
            offset += 32;

            bytes topic_zero = extract_32bytes(event_payload, offset);
            check(topic_zero == exp_topic_zero && !is_all_zeros(topic_zero), "unexpected topic zero");
            offset += 32 * 4; // skip other topics

            // Checking the protocol id against 0x02 (EOS chains)
            // If the condition is satified we expect data content to be
            // a JSON string like:
            //
            //    '{"event_bytes":"00112233445566"}'
            //
            // in hex would be
            //
            //     7b226576656e745f6279746573223a223030313132323333343435353636227d
            //
            // We want to extract 00112233445566, so this is performed by skipping
            // the first 16 chars  and the trailing 2 chars
            uint8_t protocol_id = metadata.preimage[1];
            auto start = protocol_id == 2 // EOSIO protocol
                ? event_payload.begin() + offset + 16
                : event_payload.begin() + offset;

            auto end = protocol_id == 2
                ? event_payload.end() - 2
                : event_payload.end();

            bytes raw_data(start, end);

            bytes event_data = protocol_id == 2
                ? from_utf8_encoded_to_bytes(raw_data)
                : raw_data;

            offset = 0;
            bytes nonce = extract_32bytes(event_data, offset);
            uint64_t nonce_int = bytes32_to_uint64(nonce);

            check(operation.nonce == nonce_int, "nonce do not match");
            offset += 32;

            bytes token = extract_32bytes(event_data, offset);
            checksum256 token_hash = bytes32_to_checksum256(token);
            check(operation.token == token_hash, "token address do not match");
            offset += 32;

            bytes dest_chain_id = extract_32bytes(event_data, offset);
            check(operation.destinationChainId == dest_chain_id, "destination chain id does not match with the expected one");
            check(local_chain_id == dest_chain_id, "destination chain id does not match with the current chain");
            offset += 32;

            bytes amount = extract_32bytes(event_data, offset);
            uint128_t amount_num = bytes32_to_uint128(amount);
            check(operation.amount == amount_num, "amount do not match");
            offset += 32;

            bytes sender = extract_32bytes(event_data, offset);
            check(operation.sender == sender, "sender do not match");
            offset += 32;

            bytes recipient_len = extract_32bytes(event_data, offset);
            offset += 32;
            uint128_t recipient_len_num = bytes32_to_uint128(recipient_len);
            const uint128_t UINT128_MAX = (uint128_t)-1;
            check(recipient_len_num <= UINT128_MAX - offset, "overflow detected in data field");
            bytes recipient(event_data.begin() + offset, event_data.begin() + offset + recipient_len_num);
            name recipient_name = bytes_to_name(recipient);
            check(operation.recipient == recipient_name, "recipient do not match");
            check(is_account(operation.recipient), "invalid account");

            offset += recipient_len_num;

            bytes user_data(event_data.begin() + offset, event_data.end());
            checksum256 data256 = sha256((const char*)user_data.data(), user_data.size());
            checksum256 op_data256 = sha256((const char*)operation.data.data(), operation.data.size());
            check(data256 == op_data256, "user data do not match");
        }
   };
}