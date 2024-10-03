#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

namespace eosio {
   using bytes = std::vector<uint8_t>;

   struct operation {
   public:
      // TODO: enable all the fields when
      // working on the PAM
      //
      bytes block_id;
      bytes tx_id;
      uint64_t nonce;
      checksum256 token; // erc20 on EVM
      bytes origin_chain_id;
      bytes destination_chain_id;
      uint128_t amount;
      bytes sender;
      name recipient;
      bytes data;

      // constexpr operation() : value(42) {}

      // std::string to_string() const {
      //    return std::string("Operation is ") + std::to_string(value);
      // }
   };
}