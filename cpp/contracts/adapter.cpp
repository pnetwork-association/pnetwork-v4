#include "utils.hpp"
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
   check(_token_bytes.size() == 32, "token bytes length must be 32");

   // Do not check token validity if token is not EOS local
   if (token != name(0)) check(is_account(token), "token account does not exist");
   check(is_account(xerc20), "xERC20 account does not exist");

   // Difference in precision allowed if token is not EOS local
   if (token != name(0)) check(token_symbol.precision() == xerc20_symbol.precision(), "invalid xerc20 precision");

   check(min_fee.symbol == xerc20_symbol, "invalid minimum fee symbol");

   registry_adapter _registry(get_self(), get_self().value);
   auto itr = _registry.find(token_symbol.code().raw());
   check(itr == _registry.end(), "token already registered");
   check_symbol_is_valid(xerc20, xerc20_symbol);
   if (token != name(0)) check_symbol_is_valid(token, token_symbol);

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

void adapter::settee(public_key pub_key, bytes attestation) {
   print("set tee");
   require_auth(get_self());
   tee_pubkey _tee_pubkey(get_self(), get_self().value);

   _tee_pubkey.get_or_create(
      get_self(),
      pam::tee{.key = public_key()}
   );

   _tee_pubkey.set(pam::tee{
      .key = pub_key 
   }, get_self());

   // print("attestation: ")
}

void adapter::settopiczero(bytes chain_id, bytes topic_zero) {
   require_auth(get_self());
   check(topic_zero.size() == 32, "Expected 32 bytes emitter");
   check(chain_id.size() == 32, "Expected 32 bytes chain_id");
   mappings_table _mappings_table(get_self(), get_self().value);

   auto mappings_itr = _mappings_table.find(pam::get_mappings_key(chain_id));

   if (mappings_itr == _mappings_table.end()) {
      _mappings_table.emplace(get_self(), [&](auto& row) {
         row.chain_id = chain_id;
         row.topic_zero = topic_zero;
      });

      print("Added a new mapping for chain_id: ", pam::get_mappings_key(chain_id));
   } else {
      _mappings_table.modify(mappings_itr, get_self(), [&](auto& row) {
         row.topic_zero = topic_zero;
      });

      print("Updated the topic zero for chain_id: ", pam::get_mappings_key(chain_id));
   }
}

void adapter::setemitter(bytes chain_id , bytes emitter) {
   print("set emitter");
   require_auth(get_self());
   check(emitter.size() == 32, "Expected 32 bytes emitter");
   check(chain_id.size() == 32, "Expected 32 bytes chain_id");
   mappings_table _mappings_table(get_self(), get_self().value);

   auto mappings_itr = _mappings_table.find(pam::get_mappings_key(chain_id));
   if (mappings_itr == _mappings_table.end()) {
      _mappings_table.emplace(get_self(), [&](auto& row) {
         row.chain_id = chain_id;
         row.emitter = emitter;
      });

      print("Added a new mapping for chain_id: ", pam::get_mappings_key(chain_id));
   } else {
      _mappings_table.modify(mappings_itr, get_self(), [&](auto& row) {
         row.emitter = emitter;
      });

      print("Updated the emitter for chain_id: ", pam::get_mappings_key(chain_id));
   }
}

void adapter::settle(const name& caller, const operation& operation, const metadata& metadata) {
   require_auth(caller);

   registry_adapter _registry(get_self(), get_self().value);
   auto idx_registry = _registry.get_index<adapter_registry_idx_token_bytes>();
   auto search_token_bytes = idx_registry.find(operation.token);
   check(search_token_bytes != idx_registry.end(), "invalid token");

   checksum256 event_id = sha256((const char*)metadata.preimage.data(), metadata.preimage.size());
   tee_pubkey _tee_pubkey(get_self(), get_self().value);
   public_key tee_key = _tee_pubkey.get().key;

   uint128_t a = 2;
   bytes origin_chain_id = pam::extract_32bytes(metadata.preimage, a);

   mappings_table _mappings_table(get_self(), get_self().value);

   auto itr_mappings = _mappings_table.find(pam::get_mappings_key(origin_chain_id));
   check(itr_mappings != _mappings_table.end(), "Unauthorized: origin chain_id not registered");
   bytes exp_emitter = itr_mappings->emitter;
   bytes exp_topic_zero =  itr_mappings->topic_zero;
   pam::check_authorization(operation, metadata, event_id, tee_key, exp_emitter, exp_topic_zero);

   past_events _past_events(get_self(), get_self().value);
   auto idx_past_events = _past_events.get_index<adapter_registry_idx_eventid>();
   auto itr = idx_past_events.find(event_id);

   // TODO: disabled for tests, enable this when PAM is ready
   check(itr == idx_past_events.end(), "event already processed");
   _past_events.emplace(caller, [&](auto& r) { r.event_id = event_id; });

   name xerc20 = search_token_bytes->xerc20;
   check(is_account(xerc20), "Not valid xerc20 name");
   if (operation.amount > 0) {
      auto quantity = from_wei(
         operation.amount,
         search_token_bytes->xerc20_symbol
      );

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

bytes pam::extract_32bytes(const bytes& data, uint128_t offset) {
   bytes _data(data.begin() + offset, data.begin() + offset + 32);
   return _data;
}

signature pam::convert_bytes_to_signature(const bytes& input_bytes) {
   check(input_bytes.size() == 65, "Signature must be exactly 65 bytes");
   std::array<char, 65> sig_data;
   std::copy(input_bytes.begin(), input_bytes.end(), sig_data.begin());
   return signature(std::in_place_index<0>, sig_data);
}

bool pam::context_checks(const operation& operation, const metadata& metadata) {
   uint8_t offset = 2; // Skip protocol, verion
   bytes origin_chain_id = extract_32bytes(metadata.preimage, offset);

   if (origin_chain_id != operation.originChainId) {
      return false;
   }

   offset += 32; 
   bytes block_id = extract_32bytes(metadata.preimage, offset);

   offset += 32;
   bytes tx_id = extract_32bytes(metadata.preimage, offset);

   if (block_id != operation.blockId || tx_id != operation.txId) {
      return false;
   }

   return true;
}

uint64_t pam::get_mappings_key(const bytes& chain_id) {
   eosio::check(chain_id.size() == 32, "Chain ID must be 32 bytes long.");
   return (static_cast<uint64_t>(chain_id[24]) << 56) |
      (static_cast<uint64_t>(chain_id[25]) << 48) |
      (static_cast<uint64_t>(chain_id[26]) << 40) |
      (static_cast<uint64_t>(chain_id[27]) << 32) |
      (static_cast<uint64_t>(chain_id[28]) << 24) |
      (static_cast<uint64_t>(chain_id[29]) << 16) |
      (static_cast<uint64_t>(chain_id[30]) << 8)  |
      (static_cast<uint64_t>(chain_id[31]));
}

bool pam::is_all_zeros(const bytes& emitter) {
   return std::all_of(emitter.begin(), emitter.end(), [](uint8_t byte) {
      return byte == 0x00;
   });
}

uint128_t pam::bytes32_to_uint128(const bytes& data) {
   check(data.size() == 32, "The input must be 32 bytes long.");
   // Check for overflow (first 16 bytes must be 0, bigger numbers not supported)
   for (size_t i = 0; i < 16; ++i) {
      if (data[i] != 0) {
            check(false, "Overflow: The number exceeds 128 bits.");
      }
   }

   uint128_t result = 0;
   for (size_t i = 16; i < 32; ++i) {
      result <<= 8;
      result |= data[i];
   }

   return result;
}

uint64_t pam::bytes32_to_uint64(const bytes& data) {
   check(data.size() == 32, "The input must be 32 bytes long.");
   // Check for overflow (first 8 bytes must be 0, bigger numbers not supported)
   for (size_t i = 0; i < 8; ++i) {
      if (data[i] != 0) {
            check(false, "Overflow: The number exceeds 64 bits.");
      }
   }

   uint64_t result = 0;
   for (size_t i = 8; i < 32; ++i) {
      result <<= 8;
      result |= data[i];
   }

   return result;
}

checksum256 pam::bytes32_to_checksum256(const bytes& data) {
   check(data.size() == 32, "The input must be 32 bytes long.");
   std::array<uint8_t, 32> byte_array;
   std::copy(data.begin(), data.end(), byte_array.begin());
   return checksum256(byte_array);
}

name pam::bytes_to_name(const bytes& data) {
   // check(data.size() <= 12, "Input is too long for EOSIO name (max 12 characters).");
   uint8_t length = std::min(static_cast<uint8_t>(data.size()), static_cast<uint8_t>(8));
   std::string name_str;
   for (uint8_t byte : data) {
      char eosio_char = static_cast<char>(byte);
      name_str += eosio_char;
   }
   name name_value(name_str);
   return name_value;
}

void pam::check_authorization(const operation& operation, const metadata& metadata, checksum256 event_id, const public_key& tee_key, const bytes& exp_emitter, const bytes& exp_topic_zero) {
   check(context_checks(operation, metadata), "Unauthorized: Unexpected context");

   signature sig = convert_bytes_to_signature(metadata.signature);
   public_key recovered_pubkey = recover_key(event_id, sig);
   check(recovered_pubkey == tee_key, "Unauthorized: Key are not matching");

   uint128_t offset = 0; 
   bytes event_payload(metadata.preimage.begin() + 98, metadata.preimage.end());
   bytes emitter = extract_32bytes(event_payload, offset);
   check(emitter == exp_emitter && !is_all_zeros(emitter), "Unauthorized: Unexpected Emitter");
   offset += 32;

   bytes topic_zero = extract_32bytes(event_payload, offset);
   check(topic_zero == exp_topic_zero && !is_all_zeros(topic_zero), "Unauthorized: unexpected Topic Zero");
   offset += 32 * 3; // skip other topics

   // check nonce
   bytes event_data(event_payload.begin() + offset, event_payload.end());
   bytes nonce = extract_32bytes(event_data, offset);
   uint64_t nonce_int = bytes32_to_uint64(nonce);
   check(operation.nonce == nonce_int, "Unauthorized: nonce do not match");
   offset += 32;

   // check origin token
   bytes token = extract_32bytes(event_data, offset);
   checksum256 token_hash = bytes32_to_checksum256(token);
   check(operation.token == token_hash, "Unauthorized: token adddress do not match");
   offset += 32;

   // check destination chain id
   bytes dest_chain_id = extract_32bytes(event_data, offset);
   check(operation.destinationChainId == dest_chain_id, "Unauthorized: destination chain Id do not match");
   offset += 32;

   // check amount
   bytes amount = extract_32bytes(event_data, offset);
   uint128_t amount_num = bytes32_to_uint128(amount);
   check(operation.amount == amount_num, "Unauthorized: amount do not match");
   offset += 32;
   
   // check sender address
   bytes sender = extract_32bytes(event_data, offset);
   check(operation.sender == sender, "Unauthorized: sender do not match");
   offset += 32;

   // check recipient address
   bytes recipient_len = extract_32bytes(event_data, offset);
   offset += 32;
   uint128_t recipient_len_num = bytes32_to_uint128(recipient_len);
   const uint128_t UINT128_MAX = (uint128_t)-1;
   check(recipient_len_num <= UINT128_MAX - offset, "Unauthorized: overflow detected in data field");
   bytes recipient(event_data.begin() + offset, event_data.begin() + offset + recipient_len_num);
   name recipient_name = bytes_to_name(recipient);
   check(operation.recipient == recipient_name, "Unauthorized: recipient do not match");
   offset += recipient_len_num;

   //check user data -- FIXME --
   bytes user_data(event_data.begin() + offset, event_data.end());
   // TODO fix user data decoding
   checksum256 data256 = sha256((const char*)user_data.data(), user_data.size());
   checksum256 op_data256 = sha256((const char*)operation.data.data(), operation.data.size());
}

} // namespace eosio