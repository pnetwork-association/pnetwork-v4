#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

namespace eosio {
   TABLE lockbox_registry_table {
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

   constexpr name lockbox_registry_idx_xtoken_name = "byxtoken2"_n;

   typedef indexed_by<
      lockbox_registry_idx_xtoken_name,
      const_mem_fun<lockbox_registry_table,
      uint64_t,
      &lockbox_registry_table::secondary_key>
   > lockbox_registry_byxtoken;
}