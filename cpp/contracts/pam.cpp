#include "pam.hpp"
#include "metadata.hpp"
#include "operation.hpp"
#include <eosio/crypto.hpp>

using namespace eosio;
using bytes = std::vector<uint8_t>;

bytes pam::extract_32bytes(const metadata& metadata, uint8_t offset) {
   bytes data(metadata.preimage.begin() + offset, metadata.preimage.begin() + offset + 32);
   return data;
}

signature pam::convert_bytes_to_signature(const bytes& input_bytes) {
   check(input_bytes.size() == 65, "Signature must be exactly 65 bytes");
   std::array<char, 65> sig_data;
   std::copy(input_bytes.begin(), input_bytes.end(), sig_data.begin());
   return signature(std::in_place_index<0>, sig_data);
}

bool pam::context_checks(const operation& operation, const metadata& metadata) {
   uint8_t offset = 2; // Skip protocol, verion
   bytes origin_chain_id = extract_32bytes(metadata, offset);

   if (origin_chain_id != operation.originChainId) {
      return false;
   }

   offset += 32; 
   bytes block_id = extract_32bytes(metadata, offset);

   offset += 32;
   bytes tx_id = extract_32bytes(metadata, offset);

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

void pam::isauthorized(name adapter, name caller, const operation& operation, const metadata& metadata) {
   require_auth(adapter);
   check(context_checks(operation, metadata), "Unexpected context");

   checksum256 event_id = sha256((const char*)metadata.preimage.data(), metadata.preimage.size());
   signature sig = convert_bytes_to_signature(metadata.signature);
   checksum256 digest = event_id;
   // signature sig = signature:: ::from_string("1da6f43a51140df1bc151b5500415ba80d53e5d21ed9b3b6092d0ab6a6a20fa370f555dea8558d61d6b93035e1b94c5497c82ef97a223466594fb280f51603c61c");
   // const char* sig = "1da6f43a51140df1bc151b5500415ba80d53e5d21ed9b3b6092d0ab6a6a20fa370f555dea8558d61d6b93035e1b94c5497c82ef97a223466594fb280f51603c61c";
   // size_t siglen = 65;
   // const char* pub = "04c3b70ff20e8fb97dd0880baa0dac540374fb9d41af5d09c51c0cd89b3f25f69675c8446ad450804cb5211cd3e0229bd6e93f59c47f2532b9613d5ff0397de900";
   // size_t publen = 65;
   // assert_recover_key( digest, sig, siglen, pub, publen );
   public_key recovered_pubkey = recover_key(event_id, sig);

   // tee_pubkey _tee_pubkey(get_self(), get_self().value);
   // auto provided_pubkey = _tee_pubkey.get().key;
   
   // check(recovered_pubkey == provided_pubkey, "Signature hasn't been provided by the expected TEE.");
   print("event_id\n");
   printhex(event_id.extract_as_byte_array().data(), event_id.extract_as_byte_array().size());
   print("\n");

   // action(
   //    permission_level{get_self(), "active"_n},
   //    adapter,  // Send back to the caller (e.g., your contract)
   //    "finalsettle"_n,  // Action name in the caller contract
   //    std::make_tuple(caller, operation, metadata)
   // ).send();


}