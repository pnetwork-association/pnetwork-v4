#pragma once

#include "metadata.hpp"
#include "operation.hpp"
#include <eosio/crypto.hpp>
#include <eosio/singleton.hpp>

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

        TABLE tee {
            public_key key;
        };

        using tee_pubkey = singleton<"tee"_n, pam::tee>;
        using lockbox_singleton = singleton<"lockbox"_n, name>;

        bytes extract_32bytes(const bytes& data, uint128_t offset);
        bool context_checks(const operation& operation, const metadata& metadata);
        signature convert_bytes_to_signature(const bytes& input_bytes);
        uint64_t get_mappings_key(const bytes& chain_id);
        bool is_all_zeros(const bytes& emitter);
        uint128_t bytes32_to_uint128(const bytes& data);
        uint64_t bytes32_to_uint64(const bytes& data);
        checksum256 bytes32_to_checksum256(const bytes& data);
        name bytes_to_name(const bytes& data);
        void check_authorization(const operation& operation, const metadata& metadata, checksum256 event_id, const public_key& tee_key, const bytes& exp_emitter, const bytes& exp_topic_zero);
        // void check_authorization(name caller, const operation& operation, const metadata& metadata, checksum256 event_id, const public_key& tee_key, const bytes& exp_emitter, const bytes& exp_topic_zero) {
   };
}