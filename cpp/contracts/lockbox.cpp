#include "lockbox.hpp"

namespace eosio {

void lockbox::check_symbol_is_valid(const name& account, const symbol& sym) {
   stats _stats(account, sym.code().raw());
   auto itr = _stats.find(sym.code().raw());
   check(itr != _stats.end(), "symbol not found");
}

void lockbox::create(
   const name& xerc20,
   const symbol& xerc20_symbol,
   const name& token,
   const symbol& token_symbol
) {
   require_auth(get_self());

   check(is_account(token), "token account does not exist");
   check(is_account(xerc20), "xERC20 account does not exist");

   registry _registry(get_self(), get_self().value);
   auto itr = _registry.find(token.value);
   check(itr == _registry.end(), "token already registered");
   check_symbol_is_valid(xerc20, xerc20_symbol);
   check_symbol_is_valid(token, token_symbol);


   _registry.emplace( get_self(), [&]( auto& r ) {
       r.xerc20 = xerc20;
       r.xerc20_symbol = xerc20_symbol;
       r.token = token;
       r.token_symbol = token_symbol;
   });
}

void lockbox::ontransfer(
   const name& from,
   const name& to,
   const asset& quantity,
   const string& memo
) {
   if (from == get_self()) return;

   check(to == get_self(), "recipient must be the contract");
   check(quantity.amount > 0, "invalid amount");

   name token = get_first_receiver();
   registry _registry(get_self(), get_self().value);
   auto search_token = _registry.find(quantity.symbol.code().raw());
   auto idx = _registry.get_index<name("byxtoken")>();
   auto search_xerc20 = idx.lower_bound(quantity.symbol.code().raw());

   check(
      search_token != _registry.end() ||
      search_xerc20 != idx.end(),
      "token not registered"
   );


   if (search_token != _registry.end()) {
      check(search_token->token == token, "invalid first receiver");
      auto xerc20_quantity = asset(quantity.amount, search_token->xerc20_symbol);
      action(
         permission_level{ get_self(), "active"_n },
         search_token->xerc20,
         "mint"_n,
         std::make_tuple(get_self(), from, xerc20_quantity, memo)
      ).send();
   } else if (search_xerc20 != idx.end()) {
      check(search_xerc20->xerc20 == token, "invalid first receiver");
      action(
         permission_level{ get_self(), "active"_n },
         token,
         "burn"_n,
         std::make_tuple(get_self(), quantity, memo)
      ).send();

      auto token_quantity = asset(quantity.amount, search_xerc20->token_symbol);

      action(
         permission_level{ get_self(), "active"_n },
         search_xerc20->token,
         "transfer"_n,
         std::make_tuple(get_self(), from, token_quantity, memo)
      ).send();
   }
}
}