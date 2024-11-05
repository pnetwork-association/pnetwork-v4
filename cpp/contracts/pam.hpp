#pragma once

#include "metadata.hpp"
#include "operation.hpp"
#include <eosio/crypto.hpp>
#include <eosio/singleton.hpp>

namespace eosio {
    using bytes = std::vector<uint8_t>;
    namespace pam {
        const public_key NULL_PUBLIC_KEY = public_key();

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
        
        bool context_checks(const operation& operation, const metadata& metadata);
        void check_authorization(name adapter, const operation& operation, const metadata& metadata, checksum256 event_id);
   };
}