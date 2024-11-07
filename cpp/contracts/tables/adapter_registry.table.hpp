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
   // wram.token, '6,WRAM' => local chain is EOS, then adapter's registry is
   //
   // |_____token____|___token_symbol___|_______token_bytes_____________|_____xerc20_____|
   // | 'wram.token' |     '6,WRAM'     | bytes32(WRAM.symbol.code.raw) | 'xwram.token'  |
   //
   // NOTE: on destination chains we will set each adapter's registry
   // with bytes32(WRAM.symbol.code.raw) for WRAM
   //
   // Example:
   // WETH ERC20 => local chain is Ethereum, then adapter's registry is
   //
   // |_____token____|___token_symbol___|______token_bytes_______|_____xerc20_____|
   // |      ''      |     '0,XXX'      | bytes32(address(WETH)) | 'xweth.token'  |
   // NOTE: for not local token_symbol = '0,XXX'

   TABLE adapter_registry_table {
      name                 token;
      symbol               token_symbol;
      checksum256          token_bytes;
      name                 xerc20;
      symbol               xerc20_symbol;
      asset                min_fee;
   };
}