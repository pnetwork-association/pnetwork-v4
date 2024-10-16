#include "pam.hpp"
#include "metadata.hpp"
#include "operation.hpp"
#include <eosio/crypto.hpp>

using namespace eosio;
using bytes = std::vector<uint8_t>;

bytes pam::extract_32bytes(const bytes& data, uint128_t offset) {
   bytes _data(data.begin() + offset, data.begin() + offset + 32);
   return _data;
}

signature pam::convert_bytes_to_signature(const bytes& input_bytes) {
   check(input_bytes.size() == 65, "Signature must be exactly 65 bytes");
   std::array<char, 65> sig_data;
   std::copy(input_bytes.begin(), input_bytes.end(), sig_data.begin());
   return signature(std::in_place_index<0>, sig_data);
}

bool pam::context_checks(const operation& operation, const metadata& metadata) {
   uint8_t offset = 2; // Skip protocol, verion
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

void pam::settee(public_key pub_key, bytes attestation) {
   require_auth(get_self());
   tee_pubkey _tee_pubkey(get_self(), get_self().value);

   _tee_pubkey.get_or_create(
      get_self(),
      pam::tee{.key = public_key()}
   );

   _tee_pubkey.set(pam::tee{
      .key = pub_key 
   }, get_self());

   // print("attestation: ")
}

uint64_t pam::get_mappings_key(const bytes& chain_id) {
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

void pam::setemitter(bytes chain_id , bytes emitter) {
   require_auth(get_self());
   print("emitter", emitter.size());
   check(emitter.size() == 32, "Expected 32 bytes emitter");
   check(chain_id.size() == 32, "Expected 32 bytes chain_id");
   mappings_table _mappings_table(get_self(), get_self().value);

   auto mappings_itr = _mappings_table.find(get_mappings_key(chain_id));

   if (mappings_itr == _mappings_table.end()) {
      _mappings_table.emplace(get_self(), [&](auto& row) {
         row.chain_id = chain_id;
         row.emitter = emitter;
      });

      print("Added a new mapping for chain_id: ", get_mappings_key(chain_id));
   } else {
      _mappings_table.modify(mappings_itr, get_self(), [&](auto& row) {
         row.emitter = emitter;
      });

      print("Updated the emitter for chain_id: ", get_mappings_key(chain_id));
   }
}

bool pam::is_all_zeros(const bytes& emitter) {
   return std::all_of(emitter.begin(), emitter.end(), [](uint8_t byte) {
      return byte == 0x00;
   });
}

uint128_t pam::bytes32_to_uint128(const bytes& data) {
   check(data.size() == 32, "The input must be 32 bytes long.");
   // Check for overflow (first 16 bytes must be 0, bigger numbers not supported)
   for (size_t i = 0; i < 16; ++i) {
      if (data[i] != 0) {
            check(false, "Overflow: The number exceeds 128 bits.");
      }
   }

   uint128_t result = 0;
   for (size_t i = 16; i < 32; ++i) {
      result <<= 8;
      result |= data[i];
   }

   return result;
}

uint64_t pam::bytes32_to_uint64(const bytes& data) {
   check(data.size() == 32, "The input must be 32 bytes long.");
   // Check for overflow (first 8 bytes must be 0, bigger numbers not supported)
   for (size_t i = 0; i < 8; ++i) {
      if (data[i] != 0) {
            check(false, "Overflow: The number exceeds 64 bits.");
      }
   }

   uint64_t result = 0;
   for (size_t i = 8; i < 32; ++i) {
      result <<= 8;
      result |= data[i];
   }

   return result;
}

checksum256 pam::bytes32_to_checksum256(const bytes& data) {
   check(data.size() == 32, "The input must be 32 bytes long.");
   std::array<uint8_t, 32> byte_array;
   std::copy(data.begin(), data.end(), byte_array.begin());
   return checksum256(byte_array);
}

name pam::bytes_to_name(const bytes& data) {
   // check(data.size() <= 12, "Input is too long for EOSIO name (max 12 characters).");
   uint8_t length = std::min(static_cast<uint8_t>(data.size()), static_cast<uint8_t>(8));
   std::string name_str;
   for (uint8_t byte : data) {
      char eosio_char = static_cast<char>(byte);
      name_str += eosio_char;
   }
   name name_value(name_str);
   return name_value;
}

void pam::isauthorized(name adapter, name caller, const operation& operation, const metadata& metadata) {
   require_auth(adapter);
   check(context_checks(operation, metadata), "Unexpected context");

   checksum256 event_id = sha256((const char*)metadata.preimage.data(), metadata.preimage.size());
   signature sig = convert_bytes_to_signature(metadata.signature);
   checksum256 digest = event_id;
   public_key recovered_pubkey = recover_key(event_id, sig);

   tee_pubkey _tee_pubkey(get_self(), get_self().value);
   public_key tee_key = _tee_pubkey.get().key;
   check(recovered_pubkey == tee_key, "Key are not matching");

   uint128_t offset = 2; // Skip protocol, verion
   bytes origin_chain_id = extract_32bytes(metadata.preimage, offset);

   mappings_table _mappings_table(get_self(), get_self().value);
   auto itr = _mappings_table.find(get_mappings_key(origin_chain_id));
   check(itr != _mappings_table.end(), "Origin chain_id not registered");
   bytes exp_emitter = itr->emitter;
   bytes exp_topic_zero =  itr->topic_zero;

   offset = 0;
   bytes event_payload(metadata.preimage.begin() + 98, metadata.preimage.end());
   bytes emitter = extract_32bytes(event_payload, offset);
   check(emitter == exp_emitter && !is_all_zeros(emitter), "Unexpected Emitter");

   offset += 32;
   bytes topic_zero = extract_32bytes(event_payload, offset);
   // check(topic_zero == exp_topic_zero && !is_all_zeros(topic_zero), "Unexpected Topic Zero");

   offset += 32 * 3; // skip other topics
   bytes event_data(event_payload.begin() + offset, event_payload.end());
   bytes nonce = extract_32bytes(event_data, offset);
   uint64_t nonce_int = bytes32_to_uint64(nonce);
   check(operation.nonce == nonce_int, "Nonce do not match");
   offset += 32;
   bytes token = extract_32bytes(event_data, offset);
   checksum256 token_hash = bytes32_to_checksum256(token);
   check(operation.token == token_hash, "token adddress do not match");
   offset += 32;
   bytes dest_chain_id = extract_32bytes(event_data, offset);
   check(operation.destinationChainId == dest_chain_id, "destination chain Id do not match");
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
   check(recipient_len_num <= UINT128_MAX - offset, "Overflow detected in data field");
   bytes recipient(event_data.begin() + offset, event_data.begin() + offset + recipient_len_num);
   offset += recipient_len_num;
   name recipient_name = bytes_to_name(recipient);
   check(operation.recipient == recipient_name, "Recipient do not match");
   bytes user_data(event_data.begin() + offset, event_data.end());
   // TODO fix user data decoding
   checksum256 data256 = sha256((const char*)user_data.data(), user_data.size());
   checksum256 op_data256 = sha256((const char*)operation.data.data(), operation.data.size());
}