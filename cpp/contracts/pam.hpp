#include "metadata.hpp"
#include "operation.hpp"
#include <eosio/crypto.hpp>
#include <eosio/singleton.hpp>

using namespace eosio;
using bytes = std::vector<uint8_t>;

CONTRACT pam : public eosio::contract {
public:
    using contract::contract;

    ACTION settee(public_key pub_key, bytes attestation);

   //  ACTION settopiczero(bytes chain_id, bytes topic_zero);

    ACTION setemitter(bytes chain_id, bytes emitter);

   //  ACTION unsetemitter(bytes chain_id);

    ACTION isauthorized(name adapter, const name caller, const operation& operation, const metadata& metadata);

private:
    TABLE mappings {
        bytes chain_id;
        bytes emitter;
        bytes topic_zero;

        EOSLIB_SERIALIZE(mappings, (chain_id)(topic_zero)(emitter));

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

    typedef eosio::singleton<"tee"_n, tee> tee_pubkey;
    typedef eosio::multi_index<"mappings"_n, mappings> mappings_table;

    bytes extract_32bytes(const bytes& data, uint128_t offset);
    bool context_checks(const operation& operation, const metadata& metadata);
    signature convert_bytes_to_signature(const bytes& input_bytes);
    uint64_t get_mappings_key(const bytes& chain_id);
    bool is_all_zeros(const bytes& emitter);
    uint128_t bytes32_to_uint128(const bytes& data);
    uint64_t bytes32_to_uint64(const bytes& data);
    checksum256 bytes32_to_checksum256(const bytes& data);
    name bytes_to_name(const bytes& data);

    std::string vector_to_hex(const bytes& vec) {
        std::string hex_str;
        for (auto byte : vec) {
            hex_str += "0123456789abcdef"[byte >> 4];  // Upper nibble
            hex_str += "0123456789abcdef"[byte & 0x0f];  // Lower nibble
        }
        return hex_str;
    }
};