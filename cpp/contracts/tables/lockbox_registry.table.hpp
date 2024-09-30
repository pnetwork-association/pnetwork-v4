#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

namespace eosio {
   struct [[eosio::table]] lockbox_registry_table {
      // NOTE: EVM XERC20Lockbox contract includes
      // a isNative boolean in the storage marking
      // if the relative xERC20 wraps the native currency.
      // Here we don't need that since there isn't such
      // distintion on EOS.
      // NOTE: we need the relative symbol info for each pair
      // element since the account name alone does not identify the
      // token.
      name     token;
      symbol   token_symbol;
      name     xerc20;
      symbol   xerc20_symbol;

      uint64_t primary_key()   const { return token_symbol.code().raw(); }
      uint64_t secondary_key() const { return xerc20_symbol.code().raw(); }
   };
}