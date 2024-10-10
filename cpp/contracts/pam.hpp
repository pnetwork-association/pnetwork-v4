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

   //  ACTION setemitter(bytes chain_id, bytes emitter);

   //  ACTION unsetemitter(bytes chain_id);

    ACTION isauthorized(name adapter, const name caller, const operation& operation, const metadata& metadata);

private:
    TABLE mappings {
         checksum256 chain_id;
         checksum256 emitter;
         checksum256 topic_zero;

         EOSLIB_SERIALIZE(mappings, (chain_id)(topic_zero)(emitter));

         uint64_t primary_key() const { 
            auto byte_array = chain_id.extract_as_byte_array();
            // Combine the last 8 bytes into a single uint64_t
            return (static_cast<uint64_t>(byte_array[24]) << 56) |
                  (static_cast<uint64_t>(byte_array[25]) << 48) |
                  (static_cast<uint64_t>(byte_array[26]) << 40) |
                  (static_cast<uint64_t>(byte_array[27]) << 32) |
                  (static_cast<uint64_t>(byte_array[28]) << 24) |
                  (static_cast<uint64_t>(byte_array[29]) << 16) |
                  (static_cast<uint64_t>(byte_array[30]) << 8) |
                  (static_cast<uint64_t>(byte_array[31]));
         }
    };

    TABLE tee {
        public_key key;
    };

    typedef eosio::singleton<"tee"_n, tee> tee_pubkey;
    typedef eosio::multi_index<"mappings"_n, mappings> mappings_table;

   bytes extract_32bytes(const metadata& metadata, uint8_t offset);
   bool context_checks(const operation& operation, const metadata& metadata);
   signature convert_bytes_to_signature(const bytes& input_bytes);
};