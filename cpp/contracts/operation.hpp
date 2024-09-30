#pragma once

#include <eosio/eosio.hpp>

namespace eosio {
   using bytes = std::vector<uint8_t>;

   struct operation {
   public:
      bytes blockId;
      bytes txId;
      uint64_t nonce;
      bytes erc20;
      bytes originChainId;
      bytes destinationChainId;
      uint64_t amount;
      bytes sender;
      name recipient;
      bytes data;

      // constexpr operation() : value(42) {}

      // std::string to_string() const {
      //    return std::string("Operation is ") + std::to_string(value);
      // }
   };
}