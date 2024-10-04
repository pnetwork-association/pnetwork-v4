#include "utils.hpp"
#include "adapter.hpp"

namespace eosio {

void adapter::check_symbol_is_valid(const name& account, const symbol& sym) {
   stats _stats(account, sym.code().raw());
   auto itr = _stats.find(sym.code().raw());
   check(itr != _stats.end(), "symbol not found");
}

void adapter::create(
   const name& xerc20,
   const symbol& xerc20_symbol,
   const name& token,
   const symbol& token_symbol,
   const checksum256& token_bytes
) {
   require_auth(get_self());

   auto _token_bytes = token_bytes.extract_as_byte_array();
   check(_token_bytes.size() == 32, "token bytes length must be 32");
   check(is_account(token), "token account does not exist");
   check(is_account(xerc20), "xERC20 account does not exist");

   registry_adapter _registry(get_self(), get_self().value);
   auto itr = _registry.find(token_symbol.code().raw());
   check(itr == _registry.end(), "token already registered");
   check_symbol_is_valid(xerc20, xerc20_symbol);
   check_symbol_is_valid(token, token_symbol);

   checksum256 c;
   _registry.emplace( get_self(), [&]( auto& r ) {
       r.xerc20 = xerc20;
       r.xerc20_symbol = xerc20_symbol;
       r.token = token;
       r.token_symbol = token_symbol;
       r.token_bytes = token_bytes;
   });

   storage _storage(get_self(), get_self().value);
   _storage.get_or_create(get_self(), adapter::empty_storage);
}

void adapter::setfeemanagr(const name& fee_manager) {
   storage _storage(get_self(), get_self().value);

   check(_storage.exists(), "contract not initialized");
   auto storage = _storage.get();

   storage.feesmanager = fee_manager;

   _storage.set(storage, get_self());
}

void adapter::extract_memo_args(
   const name& self,
   const name& userdata_owner,
   const string& memo,
   string& out_sender,
   string& out_dest_chainid,
   string& out_recipient,
   bytes& out_data
) {

   const vector<string> parts = split(memo, ",");

   check(parts.size() == 4, "invalid memo format");

   out_sender = parts[0];
   out_dest_chainid = parts[1];
   out_recipient = parts[2];
   uint64_t userdata_id = stoull(parts[3]);

   check(out_sender.length() > 0, "invalid sender address");
   check(out_recipient.length() > 0, "invalid destination address");
   check(is_hex_notation(out_dest_chainid), "chain id must be 0x prefixed");
   check(out_dest_chainid.length() == 66, "chain id must be a 32 bytes hex-string");


   if (userdata_id > 0) {
      user_data table(userdata_owner, userdata_owner.value);
      auto row = table.find(userdata_id);

      check(row != table.end(), "userdata record not found");

      out_data = row->payload;
   }
}

void adapter::adduserdata(const name& caller, bytes payload) {
   require_auth(caller);
   check(payload.size() > 0, "invalid payload");

   user_data table(caller, caller.value);

   if (table.begin() == table.end()) {
      table.emplace(caller, [&](auto& r) {
          // NOTE: an id == 0 means no userdata, check extract_memo_args
          // for details
          r.id = 1;
          r.payload = payload;
      });
   } else {
      table.emplace(caller, [&](auto& r) {
          r.id = table.end()->id + 1;
          r.payload = payload;
      });
   }
}

void adapter::freeuserdata(const name& account) {
   require_auth(account);
   user_data table(account, account.value);

   for (auto itr = table.begin(); itr != table.end(); itr++) {
      table.erase(itr);
   }
}

void adapter::settle(const name& caller, const operation& operation, const metadata& metadata) {
   require_auth(caller);

   registry_adapter _registry(get_self(), get_self().value);
   auto idx_registry = _registry.get_index<adapter_registry_idx_token_bytes>();
   auto search_token_bytes = idx_registry.find(operation.token);

   check(search_token_bytes != idx_registry.end(), "invalid token");

   checksum256 event_id;
   check(pam::is_authorized(operation, metadata, event_id), "unauthorized");

   past_events _past_events(get_self(), get_self().value);
   auto idx_past_events = _past_events.get_index<adapter_registry_idx_eventid>();
   auto itr = idx_past_events.find(event_id);

   // TODO: disable for tests, enable this when PAM is ready
   // check(itr == idx_past_events.end(), "event already processed");
   // _past_events.emplace(caller, [&](auto& r) { r.event_id = event_id; });

   auto xerc20 = search_token_bytes->xerc20;

   if (operation.amount > 0) {
      auto quantity = from_wei(
         operation.amount,
         search_token_bytes->xerc20_symbol
      );

      lockbox_singleton _lockbox(xerc20, xerc20.value);

      if (_lockbox.exists()) {
         auto lockbox = _lockbox.get();

         // If the lockbox exists, we release the collateral
         action(
            permission_level{ get_self(), "active"_n },
            search_token_bytes->xerc20,
            "mint"_n,
            make_tuple(get_self(), lockbox, quantity, operation.recipient.to_string())
         ).send();

         // Inline actions flow from the one above:
         // xerc20.mint(lockbox, quantity)
         //                                           -> lockbox::onmint
         //                                           -> lockbox::ontransfer
         //                                           -> xerc20.burn(lockbox, quantity)
         //                                           -> token.transfer(lockbox, adapter, quantity, memo)
         // -> adapter::ontransfer
         // -> adapter::token_transfer_from_lockbox
      } else {
         // If lockbox does not exist, we just mint the tokens
         action(
            permission_level{ get_self(), "active"_n },
            search_token_bytes->xerc20,
            "mint"_n,
            make_tuple(get_self(), operation.recipient, quantity, operation.recipient.to_string())
         ).send();
      }
   }

   if (operation.data.size() > 0) {
      require_recipient(operation.recipient);
   }
}


void adapter::swap(const uint64_t& nonce, const bytes& event_bytes) {}


void adapter::token_transfer_from_lockbox(
   const name& self,
   const name& token,
   const asset& quantity,
   const string& memo
) {
   auto to = name(memo);

   check(is_account(to), "invalid mint recipient");
   action(
      permission_level{ self, "active"_n },
      token,
      "transfer"_n,
      make_tuple(self, to, quantity, memo)
   ).send();
}

void adapter::token_transfer_from_user(
   const name& self,
   const name& token,
   const name& lockbox,
   const asset& quantity,
   const string& memo
) {
   // Deposit
   action(
      permission_level{ self, "active"_n },
      token,
      "transfer"_n,
      make_tuple(self, lockbox, quantity, memo)
   ).send();
}

void adapter::xerc20_transfer_from_any(
   const name& self,
   const name& caller,
   const name& token,
   const name& xerc20,
   const asset& quantity,
   const string& memo
) {

   action(
      permission_level{ self, "active"_n },
      xerc20,
      "burn"_n,
      make_tuple(self, quantity, memo)
   ).send();

   string sender;
   string dest_chainid;
   string recipient;
   bytes userdata;

   extract_memo_args(self, caller, memo, sender, dest_chainid, recipient, userdata);

   storage _storage(self, self.value);

   check(_storage.exists(), "contract not initialized");

   auto storage = _storage.get();
   auto recipient_bytes = to_bytes(recipient);

   bytes event_bytes  = concat(
      32 * 6 + recipient_bytes.size() + userdata.size(),
      to_bytes32(storage.nonce),
      to_bytes32(token.to_string()),
      hex_to_bytes(dest_chainid),
      to_bytes32(to_wei(quantity)),
      to_bytes32(sender),
      to_bytes32(recipient_bytes.size()),
      recipient_bytes,
      userdata
   );

   action(
      permission_level{ self, "active"_n },
      self,
      "swap"_n,
      make_tuple(storage.nonce, event_bytes)
   ).send();

   storage.nonce++;
   _storage.set(storage, caller);
}

void adapter::ontransfer(const name& from, const name& to, const asset& quantity, const string& memo) {
   if (from == get_self()) return;

   check(to == get_self(), "recipient must be the contract");
   check(quantity.amount > 0, "invalid amount");

   registry_adapter _registry(get_self(), get_self().value);
   auto search_token = _registry.find(quantity.symbol.code().raw());
   auto idx = _registry.get_index<adapter_registry_idx_xtoken>();
   auto search_xerc20 = idx.find(quantity.symbol.code().raw());

   bool is_token_transfer = search_token != _registry.end();
   bool is_xerc20_transfer = search_xerc20 != idx.end();

   check(is_token_transfer || is_xerc20_transfer, "token not registered");

   auto xerc20 = is_token_transfer ? search_token->xerc20 : search_xerc20->xerc20;
   auto xerc20_symbol = is_token_transfer ? search_token->xerc20_symbol : search_xerc20->xerc20_symbol;
   auto token = is_token_transfer ? search_token->token : search_xerc20->token;
   auto token_symbol = is_token_transfer ? search_token->token_symbol : search_xerc20->token_symbol;

   if (is_token_transfer) check(quantity.symbol == token_symbol, "invalid token quantity symbol");
   if (is_xerc20_transfer) check(quantity.symbol == xerc20_symbol, "invalid xerc20 quantity symbol");

   if(is_token_transfer) {
      lockbox_singleton _lockbox(xerc20, xerc20.value);
      check(_lockbox.exists(), "lockbox is not set for the underlying token");
      auto lockbox = _lockbox.get();
      if (from == lockbox) {
         token_transfer_from_lockbox(get_self(), token, quantity, memo);
      } else {
         token_transfer_from_user(get_self(), token, lockbox, quantity, memo);
      }
   } else {
      xerc20_transfer_from_any(get_self(), from, token, xerc20, quantity, memo);
   }
}

void adapter::onmint(const name& caller, const name& to, const asset& quantity, const string& memo) {
   ontransfer(caller, to, quantity, memo);
}

}

