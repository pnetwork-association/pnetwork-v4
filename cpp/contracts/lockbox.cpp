#include "lockbox.hpp"

namespace eosio {

void lockbox::check_symbol_is_valid(const name& account, const symbol& sym) {
   stats _stats(account, sym.code().raw());
   auto itr = _stats.find(sym.code().raw());
   check(itr != _stats.end(), "symbol not found");
}

void lockbox::init(
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

[[eosio::on_notify("*::transfer")]]
void lockbox::deposit(
   const name& from,
   const name& to,
   const asset& quantity,
   const string& memo
) {
   if (from == get_self()) return;

   require_auth(from);
   check(to != get_self(), "invalid receiver");
   check(quantity.amount > 0, "invalid amount");

   name token = get_first_receiver();

   registry _registry(get_self(), get_self().value);
   auto itr = _registry.find(token.value);

   check(itr != _registry.end(), "token not registered");

   auto xerc20_quantity = asset(quantity.amount, itr->xerc20_symbol);
   action(
      permission_level{ get_self(), "active"_n },
      "eosio.token"_n,
      "mint"_n,
      std::make_tuple(get_self(), from, xerc20_quantity, memo)
   ).send();
}

   // void lockbox::depositto(const name& user, const asset& amount);
   // void lockbox::withdraw(const asset& amount);
   // void lockbox::withdrawto(const name& user, const asset& amount);
}