#include "adapter.hpp"

namespace eosio {

asset adapter::calculate_fees(const asset& quantity) {
   registry_adapter _registry(get_self(), get_self().value);
   auto idx = _registry.get_index<adapter_registry_idx_xtoken>();
   auto search_token = _registry.find(quantity.symbol.code().raw());
   auto search_xerc20 = idx.find(quantity.symbol.code().raw());

   asset min_fee;
   if (search_token != _registry.end()) {
      min_fee = search_token->min_fee;
   } else if (search_xerc20 != idx.end()) {
      min_fee = search_xerc20->min_fee;
   } else {
      check(false, "invalid quantity given for calculating the fees");
   }

   // Fees are expressed in the wrapped token (xerc20), hence why
   // the min_fee.symbol
   auto ref_symbol = min_fee.symbol;

   uint128_t fee_amount = (FEE_BASIS_POINTS * quantity.amount) / FEE_BASIS_POINTS_DIVISOR;
   asset fee = asset(fee_amount, ref_symbol);

   return fee < min_fee ? min_fee : fee;
}

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
   const checksum256& token_bytes,
   const asset& min_fee
) {
   require_auth(get_self());

   auto _token_bytes = token_bytes.extract_as_byte_array();
   check(is_account(xerc20), "xERC20 account does not exist");
   check(min_fee.symbol == xerc20_symbol, "invalid minimum fee symbol");

   registry_adapter _registry(get_self(), get_self().value);
   auto itr = _registry.find(token_symbol.code().raw());
   check(itr == _registry.end(), "token already registered");
   check_symbol_is_valid(xerc20, xerc20_symbol);

   if (token != name(0)) {
      // Check token symbol if toekn is local to a EOS like chain
      check_symbol_is_valid(token, token_symbol);
      // Difference in precision allowed if token is not local
      check(token_symbol.precision() == xerc20_symbol.precision(), "invalid xerc20 precision");
      // Do not check token validity if token is not local
      check(is_account(token), "token account does not exist");
   }

   checksum256 c;
   _registry.emplace( get_self(), [&]( auto& r ) {
       r.xerc20 = xerc20;
       r.xerc20_symbol = xerc20_symbol;
       r.token = token;
       r.token_symbol = token_symbol;
       r.token_bytes = token_bytes;
       r.min_fee = min_fee;
   });

   storage _storage(get_self(), get_self().value);
   _storage.get_or_create(get_self(), adapter::empty_storage);
}

void adapter::setfeemanagr(const name& fee_manager) {
   require_auth(get_self());
   storage _storage(get_self(), get_self().value);

   check(_storage.exists(), "adapter contract not initialized");
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
   check(is_hex_notation(parts[1]), "chain id must be 0x prefixed");

   out_sender = parts[0];
   out_dest_chainid = parts[1].substr(2);
   out_recipient = parts[2];
   uint64_t userdata_id = stoull(parts[3]);

   check(out_sender.length() > 0, "invalid sender address");
   check(out_recipient.length() > 0, "invalid destination address");
   check(out_dest_chainid.length() == 64, "chain id must be a 32 bytes hex-string");


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

void adapter::settee(public_key pub_key, bytes attestation) {
   // FIXME add cool down phase
   require_auth(get_self());
   pam::tee_pubkey _tee_pubkey(get_self(), get_self().value);

   _tee_pubkey.set(pam::tee{
      .key = pub_key,
      .attestation = attestation
   }, get_self());
}

void adapter::setorigin(bytes chain_id, bytes emitter, bytes topic_zero) {
   require_auth(get_self());
   check(chain_id.size() == 32, "expected 32 bytes chain_id");

   check(emitter.size() == 32, "expected 32 bytes emitter");
   check(topic_zero.size() == 32, "expected 32 bytes topic zero");

   pam::mappings_table _mappings_table(get_self(), get_self().value);

   auto mappings_itr = _mappings_table.find(get_mappings_key(chain_id));
   if (mappings_itr == _mappings_table.end()) {
      _mappings_table.emplace(get_self(), [&](auto& row) {
         row.chain_id = chain_id;
         row.emitter = emitter;
         row.topic_zero = topic_zero;
      });
   } else {
      _mappings_table.modify(mappings_itr, get_self(), [&](auto& row) {
         row.emitter = emitter;
         row.topic_zero = topic_zero;
      });
   }
}

void adapter::settle(const name& caller, const operation& operation, const metadata& metadata) {
   require_auth(caller);

   registry_adapter _registry(get_self(), get_self().value);
   auto idx_registry = _registry.get_index<adapter_registry_idx_token_bytes>();
   auto search_token_bytes = idx_registry.find(operation.token);
   check(search_token_bytes != idx_registry.end(), "underlying token does not match with adapter registry");
   check(search_token_bytes->xerc20_symbol == operation.amount.symbol, "registered xerc20 symbols differs from the operation one"); // TODO: test me

   checksum256 event_id; // output
   pam::check_authorization(get_self(), operation, metadata, event_id);

   past_events _past_events(get_self(), get_self().value);
   auto idx_past_events = _past_events.get_index<adapter_registry_idx_eventid>();
   auto itr = idx_past_events.find(event_id);

   check(itr == idx_past_events.end(), "event already processed");

   storage _storage(get_self(), get_self().value);
   check(_storage.exists(), "contract not initialized");
   auto storage = _storage.get();

   _past_events.emplace(caller, [&](auto& r) {
      r.notused = storage.nonce;
      r.event_id = event_id;
   });
   storage.nonce++;
   _storage.set(storage, get_self());

   name xerc20 = search_token_bytes->xerc20;
   check(is_account(xerc20), "Not valid xerc20 name");
   if (operation.amount.amount > 0) {
      asset quantity(operation.amount.amount, search_token_bytes->xerc20_symbol);

      lockbox_singleton _lockbox(xerc20, xerc20.value);
      action_mint _mint(search_token_bytes->xerc20, {get_self(), "active"_n});
      if (_lockbox.exists()) {
         // If the lockbox exists, we release the collateral
         auto lockbox = _lockbox.get();

         check(is_account(lockbox), "lockbox must be a valid account");

         _mint.send(get_self(), lockbox, quantity, operation.recipient.to_string());
         // Inline actions flow from the one above:
         // xerc20.mint(lockbox, quantity) -> lockbox::onmint -> lockbox::ontransfer
         // -> xerc20.burn(lockbox, quantity) -> token.transfer(lockbox, adapter, quantity, memo)
         // -> adapter::ontransfer -> adapter::token_transfer_from_lockbox
      } else {
         // If lockbox does not exist, we just mint the tokens
         _mint.send(get_self(), operation.recipient, quantity, operation.recipient.to_string());
      }
   }

   if (operation.data.size() > 0) {
      require_recipient(operation.recipient);
   }
}

void adapter::swap(const uint64_t& nonce, const bytes& event_bytes) {
   require_auth(get_self());

   // IMPORTANT: this is for the tests, vert doesn't correctly
   // deserialize the event_bytes arg, so we'll get it from
   // the bc.console
   // NOTE: performance are not affected by this
   print("adapter_swap_event_bytes:");
   printhex(event_bytes.data(), event_bytes.size());
}

void adapter::token_transfer_from_lockbox(
   const name& self,
   const name& token,
   const asset& quantity,
   const string& memo
) {
   auto to = name(memo);

   check(is_account(to), "invalid mint recipient");
   action_transfer _transfer{token, {self, "active"_n}};
   _transfer.send(self, to, quantity, memo);
}

void adapter::token_transfer_from_user(
   const name& self,
   const name& token,
   const name& lockbox,
   const asset& quantity,
   const string& memo
) {
   // Deposit
   action_transfer _transfer{token, {self, "active"_n}};
   _transfer.send(self, lockbox, quantity, memo);
}

void adapter::xerc20_transfer_from_any(
   const name& self,
   const name& caller,
   const name& token,
   const name& xerc20,
   const asset& quantity,
   const string& memo
) {
   storage _storage(self, self.value);
   check(_storage.exists(), "contract not initialized");
   auto storage = _storage.get();

   check(is_account(storage.feesmanager), "invalid fees manager account");

   asset fees = calculate_fees(quantity);

   check(quantity.amount >= fees.amount, "quantity can't cover fees");

   asset net_amount = quantity - fees;

   action_transfer _transfer{xerc20, {self, "active"_n}};
   _transfer.send(self, storage.feesmanager, fees, string(""));

   action_burn _burn{xerc20, {self, "active"_n}};
   _burn.send(self, net_amount, memo);

   string sender;
   string dest_chainid;
   string recipient;
   bytes userdata;

   extract_memo_args(self, caller, memo, sender, dest_chainid, recipient, userdata);

   auto recipient_bytes = to_bytes(recipient);

   bytes event_bytes  = concat(
      32 * 6 + recipient_bytes.size() + userdata.size(),
      to_bytes32(storage.nonce),
      to_bytes32(token.to_string()),
      hex_to_bytes(dest_chainid),
      to_bytes32(to_wei(net_amount)),
      to_bytes32(sender),
      to_bytes32(recipient_bytes.size()),
      recipient_bytes,
      userdata
   );

   action_swap _swap{self, {self, "active"_n}};
   _swap.send(storage.nonce, event_bytes);

   storage.nonce++;
   _storage.set(storage, self);
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

   if (is_token_transfer) {
      lockbox_singleton _lockbox(xerc20, xerc20.value);
      check(_lockbox.exists(), "lockbox is not set for the underlying token");
      auto lockbox = _lockbox.get();
      check(is_account(lockbox), "lockbox must be a valid account");
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
} // namespace eosio