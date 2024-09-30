#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

namespace eosio {
   using bytes = std::vector<uint8_t>;

   struct operation {
   public:
      // bytes blockId;
      // bytes txId;
      // uint64_t nonce;
      checksum256 token; // erc20 on EVM
      // bytes originChainId;
      // bytes destinationChainId;
      // asset quantity; // amount on EVM
      // bytes sender;
      // name recipient;
      // bytes data;

      // constexpr operation() : value(42) {}

      // std::string to_string() const {
      //    return std::string("Operation is ") + std::to_string(value);
      // }
   };
}