#pragma once

#include <vector>

namespace eosio {
   using bytes = std::vector<uint8_t>;

   struct metadata {
   public:
      bytes preimage;
      bytes signature;
   };
}