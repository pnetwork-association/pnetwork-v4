#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <eosio/singleton.hpp>

#include <string>

#include "pam.hpp"
#include "operation.hpp"
#include "metadata.hpp"

namespace eosio {
   using std::string;

   class [[eosio::contract("test.pam")]] testpam : public contract {
      public:
         using contract::contract;

         ACTION setadapter(const name& adapter);
         ACTION isauthorized(const operation& operation,const metadata& metadata);

      private:
         using adapter_singleton = singleton<"adapter"_n, name>;
   };
}