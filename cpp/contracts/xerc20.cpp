#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/singleton.hpp>
using namespace eosio;

CONTRACT xerc20 : public contract {
   public:
      using contract::contract;

   const symbol TOKEN_SYMBOL = symbol(symbol_code("GOLD"), 4);

   TABLE model_balance {
      name     owner;
      asset    balance;

      uint64_t primary_key()const {
         return owner.value;
      }
   };

   TABLE model_bridge {
      name        account;
      uint64_t    minting_limit;
      uint64_t    burning_limit;
   };

   using balances_table = multi_index<"balances"_n, model_balance>;
   using table_supply = singleton<"supply"_n, asset>;
   using table_symbol = singleton<"symbol"_n, symbol>;

   // Initialize the contract with the given token name
   // (defaults to 18 decimals for EVM compatibility)
   ACTION init(std::string name) {
      require_auth(permission_level(get_self(), "active"_n));

      table_symbol _symbol(get_self(), get_self().value);
      check(!_symbol.exists(), "contract already initialized");

      table_supply _supply(get_self(), get_self().value);

      auto token = symbol(symbol_code(name), 18);
      _symbol.set(token, get_self());
      _supply.set(asset(0, token), get_self());
   }

   ACTION issue(name to, asset quantity) {
      check(has_auth(get_self()), "only contract owner can issue new GOLD");
      check(is_account(to), "the account you are trying to issue GOLD to does not exist");
      check(quantity.is_valid(), "invalid quantity");
      check(quantity.amount > 0, "must issue a positive quantity");
      check(quantity.symbol == TOKEN_SYMBOL, "symbol precision and/or ticker mismatch");

      balances_table balances(get_self(), get_self().value);

      auto to_balance = balances.find(to.value);

      if(to_balance != balances.end()) {
            balances.modify(to_balance, get_self(), [&](auto& row) {
               row.balance += quantity;
            });
      }
      else{
            balances.emplace(get_self(), [&](auto& row) {
               row.owner = to;
               row.balance = quantity;
            });
      }

      table_supply supply(get_self(), get_self().value);

      auto current_supply = supply.get_or_default(asset(0, TOKEN_SYMBOL));

      supply.set(current_supply + quantity, get_self());
   }

   ACTION burn(name owner, asset quantity) {
      check(has_auth(owner), "only the owner of these tokens can burn them");
      check(quantity.is_valid(), "invalid quantity");
      check(quantity.amount > 0, "must burn a positive quantity");
      check(quantity.symbol == TOKEN_SYMBOL, "symbol precision and/or ticker mismatch");

      balances_table balances(get_self(), get_self().value);
      auto owner_balance = balances.find(owner.value);
      check(owner_balance != balances.end(), "account does not have any GOLD");
      check(owner_balance->balance.amount >= quantity.amount, "owner doesn't have enough GOLD to burn");

      auto new_balance = owner_balance->balance - quantity;
      check(new_balance.amount >= 0, "quantity exceeds available supply");

      if(new_balance.amount == 0) {
         balances.erase(owner_balance);
      }
      else {
         balances.modify(owner_balance, get_self(), [&](auto& row) {
               row.balance -= quantity;
         });
      }

      table_supply supply(get_self(), get_self().value);
      supply.set(supply.get() - quantity, get_self());
   }

   ACTION transfer(name from, name to, asset quantity, std::string memo) {
      check(has_auth(from), "only the owner of these tokens can transfer them");
      check(is_account(to), "to account does not exist");
      check(quantity.is_valid(), "invalid quantity");
      check(quantity.amount > 0, "must transfer a positive quantity");
      check(quantity.symbol == TOKEN_SYMBOL, "symbol precision and/or ticker mismatch");

      balances_table balances(get_self(), get_self().value);
      auto from_balance = balances.find(from.value);
      check(from_balance != balances.end(), "from account does not have any GOLD");
      check(from_balance->balance.amount >= quantity.amount, "from account doesn't have enough GOLD to transfer");

      auto to_balance = balances.find(to.value);
      if(to_balance == balances.end()) {
         balances.emplace(get_self(), [&](auto& row) {
               row.owner = to;
               row.balance = quantity;
         });
      }
      else {
         balances.modify(to_balance, get_self(), [&](auto& row) {
               row.balance += quantity;
         });
      }

      if(from_balance->balance.amount == quantity.amount) {
         balances.erase(from_balance);
      }
      else {
         balances.modify(from_balance, get_self(), [&](auto& row) {
               row.balance -= quantity;
         });
      }

      require_recipient(from);
      require_recipient(to);
   }
};