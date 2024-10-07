#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

namespace eosio {
   // NOTE: in order to differentiate an adapter
   // deployed on the local chain to one deployed
   // on destination chains we check the token column, if
   // empty it means we are on a destination chain and the
   // native token is somewhere else (i.e. wETH on Ethereum)
   //
   // Example:
   // wram.token => local chain is EOS, then adapter's registry is
   //
   // |_____token_____|_______token_bytes_____________|_____xerc20_____|
   // | 'wram.token'  | bytes32(WRAM.symbol.code.raw) | 'xwram.token'  |
   //
   // NOTE: on destination chains we will set each adapter's registry
   // with bytes32('wram.token') for WRAM
   //
   // Example:
   // WETH ERC20 => local chain is Ethereum, then adapter's registry is
   //
   // |_____token_____|______token_bytes_______|_____xerc20_____|
   // |      ''       | bytes32(address(WETH)) | 'xweth.token'  |
   //
   struct [[eosio::table]] adapter_registry_table {
      name                 token;
      symbol               token_symbol;
      checksum256          token_bytes;
      name                 xerc20;
      symbol               xerc20_symbol;
      asset                min_fee;

      uint64_t primary_key()    const { return token_symbol.code().raw(); }
      uint64_t secondary_key()  const { return xerc20_symbol.code().raw(); }
      const checksum256& ternary_key() const { return token_bytes; }
   };

   constexpr name adapter_registry_idx_xtoken = "byxtoken1"_n;
   constexpr name adapter_registry_idx_token_bytes = "bytokenbytes"_n;

   typedef indexed_by<
      adapter_registry_idx_xtoken,
      const_mem_fun<
         adapter_registry_table,
         uint64_t,
         &adapter_registry_table::secondary_key
      >
   > adapter_registry_byxtoken;

   typedef indexed_by<
      adapter_registry_idx_token_bytes,
      const_mem_fun<
         adapter_registry_table,
         const checksum256&,
         &adapter_registry_table::ternary_key
      >
   > adapter_registry_bytokenbytes;
}