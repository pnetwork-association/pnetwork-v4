#include "metadata.hpp"
#include "operation.hpp"

using namespace eosio;
using bytes = std::vector<uint8_t>;

bytes extract_32bytes(const metadata& metadata, uint16_t offset) {
   // if (offset + 32 > metadata.preimage.size()) {
   bytes data(metadata.preimage.begin() + offset, metadata.preimage.begin() + offset + 32);
   return data;
}

bool context_checks(const operation& operation, const metadata& metadata) {
   uint16_t offset = 2; // Skip protocol, version
    
   bytes origin_chain_id = extract_32bytes(metadata, offset);

   if (origin_chain_id != operation.origin_chain_id) {
      return false;
   }

   offset += 32; 
   bytes block_id = extract_32bytes(metadata, offset);

   offset += 32;
   bytes tx_id = extract_32bytes(metadata, offset);

   if (block_id != operation.block_id || tx_id != operation.tx_id) {
      return false;
   }

   return true;
}

bool is_authorized(const operation& operation, const metadata& metadata) {
   return context_checks(operation, metadata);
}