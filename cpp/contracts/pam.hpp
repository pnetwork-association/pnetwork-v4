#pragma once

#include "operation.hpp"
#include "metadata.hpp"

namespace eosio {
   using bytes = std::vector<uint8_t>;
   namespace pam {
      bool is_authorized(const operation& _operation, const metadata& _metadata, const checksum256& out_event_id) {
         // TODO: not implemented
         return true;
      }
   };
}