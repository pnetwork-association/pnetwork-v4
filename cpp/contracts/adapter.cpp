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
}

void adapter::setfeemanagr(const name& fee_manager) {
   storage _storage(get_self(), get_self().value);

   _storage.get_or_create(
      get_self(),
      adapter::empty_storage
   );

   _storage.set(adapter::global_storage_model{
      .feesmanager = fee_manager
   }, get_self());
}

void adapter::setpam(const name& pam) {
   storage _storage(get_self(), get_self().value);

   _storage.get_or_create(
      get_self(),
      adapter::empty_storage
   );

   _storage.set(adapter::global_storage_model{
      .pam = pam
   }, get_self());
}

void adapter::extract_memo_args(
   const name& self,
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
   string has_userdata = parts[3];

   check(out_sender.length() > 0, "invalid sender address");
   check(out_recipient.length() > 0, "invalid destination address");
   check(is_hex_notation(out_dest_chainid), "chain id must be 0x prefixed");
   check(out_dest_chainid.length() == 66, "chain id must be a 32 bytes hex-string");

   if (has_userdata == "1") {
      // FIXME: use linked actions pattern here
      // https://docs.eosnetwork.com/docs/latest/guides/linked-actions-pattern
      action act = get_action(1, 1);
      check(act.name == "adduserdata"_n, "expected adduserdata action");
      check(act.account == self, "adduserdata must come from adapter contract");
      check(get_num_of_actions() == 2, "expected two actions");
      // TODO: factor out into adapter.hpp
      typedef struct { bytes user_data; } unpacked_data;
      unpacked_data data = unpack<unpacked_data>(act.data);

      check(data.user_data.size() == 0, "no userdata found");
      out_data = data.user_data;
   }
}

void adapter::adduserdata(bytes user_data) {}

void adapter::settle(const name& caller, const operation& operation, const metadata& metadata) {
   print("\nadapter::settle\n");

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

   check(itr == idx_past_events.end(), "event already processed");

   _past_events.emplace(caller, [&](auto& r) { r.event_id = event_id; });

   // TODO?: check quantity symbols against the
   // operation token

   // TODO: check recipient is a valid account

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
         print("\nxerc20.mint->", lockbox.to_string(), "\n");
         action(
            permission_level{ get_self(), "active"_n },
            search_token_bytes->xerc20,
            "mint"_n,
            make_tuple(get_self(), lockbox, quantity, operation.recipient.to_string())
         ).send();

         // Inline actions flow from here (get_self() := this contract):
         // lockbox::onmint -> lockbox::ontransfer -> xerc20::burn -> token::transfer(lockbox, get_self(), quantity, memo)
      } else {
         // If lockbox does not exist, we just mint the tokens
         print("\nxerc20.mint->", operation.recipient, "\n");
         action(
            permission_level{ get_self(), "active"_n },
            search_token_bytes->xerc20,
            "mint"_n,
            make_tuple(get_self(), operation.recipient, quantity, operation.recipient.to_string())
         ).send();
      }
   }

   if (operation.data.size() > 0) {
      // TODO?: apply try/catch
      action(
         permission_level{ get_self(), "active"_n },
         operation.recipient,
         "receiveudata"_n,
         make_tuple(get_self(), operation.data)
      ).send();
   }
}


void adapter::swap(const uint64_t& nonce, const bytes& event_bytes) {}


void adapter::token_transfer_from_lockbox(
   const name& self,
   const name& token,
   const asset& quantity,
   const string& memo
) {
   print("\ntoken_transfer_from_lockbox\n");
   auto to = name(memo);

   check(is_account(to), "invalid mint recipient");
   print("\ntoken.transfer->", to.to_string(), "\n");
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
   print("\ntoken.transfer->", lockbox.to_string(), "\n");
   action(
      permission_level{ self, "active"_n },
      token,
      "transfer"_n,
      make_tuple(self, lockbox, quantity, memo)
   ).send();
}

void adapter::xerc20_transfer_from_any(
   const name& self,
   const name& token,
   const name& xerc20,
   const asset& quantity,
   const string& memo
) {
   print("\nadapter::xerc20_transfer_from_any\n");

   print(self, "->xerc20.burn", "\n");
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

   extract_memo_args(self, memo, sender, dest_chainid, recipient, userdata);

   // TODO: get the nonce from the table here
   uint64_t nonce = 100000;

   auto recipient_bytes = to_bytes(recipient);

   bytes event_bytes  = concat(
      32 * 6 + recipient_bytes.size() + userdata.size(),
      to_bytes32(nonce),
      to_bytes32(token.to_string()),
      hex_to_bytes(dest_chainid),
      to_bytes32(to_wei(quantity)),
      to_bytes32(sender),
      to_bytes32(recipient_bytes.size()),
      recipient_bytes,
      userdata
   );

   print("\nadapter.swap\n");
   action(
      permission_level{ self, "active"_n },
      self,
      "swap"_n,
      make_tuple(nonce, event_bytes)
   ).send();

   // TODO: increase nonce here
}

void adapter::ontransfer(const name& from, const name& to, const asset& quantity, const string& memo) {
   print("\nadapter::ontransfer\n");
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
      xerc20_transfer_from_any(get_self(), token, xerc20, quantity, memo);
   }
}

void adapter::onmint(const name& caller, const name& to, const asset& quantity, const string& memo) {
   ontransfer(caller, to, quantity, memo);
}

}

