#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <eosio/fixed_bytes.hpp>

#include <string>

#include "../pam.hpp"
#include "../operation.hpp"
#include "../metadata.hpp"

namespace eosio {

class [[eosio::contract("test.pam")]] test_pam : public contract {
   using bytes = std::vector<uint8_t>;

   public:
      using contract::contract;
      [[eosio::action]]
      void isauthorized(
         const operation& operation,
         const metadata& metadata
      ) {

         print("\nciao!\n");
         checksum256 event_id;
         pam::is_authorized(operation, metadata, event_id);

         auto id = event_id.extract_as_byte_array();

         print("\nevent_id\n");
         printhex(id.data(), id.size());
      }
};
}