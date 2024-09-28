#include "adapter.hpp"

namespace eosio {


bool is_hex_notation(string const &s) {
   const string prefix = "0x";
   const string allowed_chars = "0123456789abcdefABCDEF";
   return s.size() > 2
      && s.compare(0, 2, prefix) == 0
      && s.find_first_not_of(allowed_chars, 2) == string::npos;
}

// https://github.com/stableex/sx.curve/blob/f26604725be2d1faea1eb0a1c44e0266fac37875/include/sx.utils/utils.hpp#L129
static vector<string> split(const string str, const string delim) {
   vector<string> tokens;
   if (str.size() == 0) return tokens;

   size_t prev = 0, pos = 0;
   do {
      pos = str.find(delim, prev);
      if (pos == string::npos)
         pos = str.length();
      string token = str.substr(prev, pos - prev);
      if (token.length() > 0)
         tokens.push_back(token);
      prev = pos + delim.length();
   } while (pos < str.length() && prev < str.length());

   return tokens;
}

vector<uint8_t> hex_to_bytes(const string &hex) {
   vector<uint8_t> bytes;
   for (unsigned int i = 0; i < hex.length(); i += 2) {
      string byteString = hex.substr(i, 2);
      uint8_t byte = (uint8_t)strtol(byteString.c_str(), nullptr, 16);
      bytes.push_back(byte);
   }
   return bytes;
}

size_t get_num_of_actions() {
   char tx_buffer[eosio::transaction_size()];
   eosio::read_transaction(tx_buffer, eosio::transaction_size());
   const std::vector<char> trx_vector(
         tx_buffer, tx_buffer + sizeof tx_buffer / sizeof tx_buffer[0]);
   transaction trx = eosio::unpack<transaction>(trx_vector);
   return trx.actions.size();
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
   const symbol& token_symbol
) {
   require_auth(get_self());

   check(is_account(token), "token account does not exist");
   check(is_account(xerc20), "xERC20 account does not exist");

   registry _registry(get_self(), get_self().value);
   auto itr = _registry.find(token_symbol.code().raw());
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
   string& ret_dest_chainid,
   string& ret_recipient,
   bytes& ret_data
) {

   const vector<string> parts = split(memo, ",");

   check(parts.size() == 3, "invalid memo format");

   ret_dest_chainid = parts[0];
   ret_recipient = parts[1];
   string has_userdata = parts[2];

   check(ret_recipient.length() > 0, "invalid destination address");
   check(is_hex_notation(ret_dest_chainid), "chain id must be 0x prefixed");
   check(ret_dest_chainid.length() == 66, "chain id must be a 32 bytes hex-string");

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
      ret_data = data.user_data;
   }
}


bytes to_bytes(uint64_t value, size_t size) {
   bytes vec(size, 0);

   for (size_t i = 0; i < 8; ++i) {
      uint64_t v = (value >> (i * 8)) & 0xFF;
      vec[size - i - 1] = static_cast<uint8_t>(v);
   }

   return vec;
}

bytes to_bytes32(uint64_t value) {
   return to_bytes(value, 32);
}

// Ascii to hex convertion of the account name
// Example:
// to_bytes32("tkn.token") => 0000000000000000000000000000000000000000000000746b6e2e746f6b656e
//
// NOTE: last string character positioned at the end of the bytearray
bytes to_bytes32(string value) {
   auto size = 32;
   bytes vec(size, 0);
   size_t k = 0;
   for (auto it = value.rbegin(); it != value.rend() ; ++it) {
      vec[size - k - 1] = static_cast<uint8_t>(*it);
      ++k;
   }

   return vec;
}

bytes to_bytes(string str) {
   std::vector<uint8_t> vec;
   vec.reserve(str.size());
   for (char c : str) {
      vec.push_back(static_cast<uint8_t>(c)); // Convert char to uint8_t
   }
   return vec;
}

uint64_t to_wei(asset quantity) {
   auto exp = 18 - quantity.symbol.precision();
   return quantity.amount * pow(10.0, exp);
}

// Concat a set of bytes together
template <typename... Type>
bytes concat(uint64_t size, Type... elements) {
   bytes res;
   res.reserve(size);

   for(const auto elem : { elements... }) {
      for (size_t k = 0; k < elem.size(); k++) {
         res.push_back(elem[k]);
      }
   }

   return res;
}

void adapter::adduserdata(bytes user_data) {}


//
void adapter::onmint(const name& caller, const name& to, const asset& quantity, const string& memo) {
   auto xerc20 = get_first_receiver();

   // TODO: factor out
   lockbox_singleton _lockbox(xerc20, xerc20.value);
   check(_lockbox.exists(), "lockbox not found for the specified token");
   auto lockbox = _lockbox.get();

   check(caller == lockbox, "mint must come from the lockbox");

   // TODO: accrue fees here

   print("\nxerc20.burn\n");
   action(
      permission_level{ get_self(), "active"_n },
      xerc20,
      "burn"_n,
      make_tuple(get_self(), quantity, memo)
   ).send();

   print("\nend!\n");

   // TODO: get the nonce from the table here
   // uint64_t nonce = 100000;

   // auto recipient_bytes = to_bytes(recipient);

   // bytes event_bytes = concat(
   //    32 * 6 + recipient_bytes.size() + userdata.size(),
   //    to_bytes32(nonce),
   //    to_bytes32(token.to_string()),
   //    to_bytes32(dest_chainid),
   //    to_bytes32(to_wei(quantity)),
   //    to_bytes32(from.to_string()),
   //    to_bytes32(recipient_bytes.size()),
   //    recipient_bytes,
   //    userdata
   // );

   // action(
   //    permission_level{ get_self(), "active"_n },
   //    xerc20,
   //    "swap"_n,
   //    make_tuple(get_self(), nonce, event_bytes)
   // ).send();


   // TODO: increase nonce here
}


void adapter::swap(const uint64_t& nonce, const bytes& event_bytes) {}

void adapter::ontransfer(const name& from, const name& to, const asset& quantity, const string& memo) {
   print("\nadapter::ontransfer\n");
   if (from == get_self()) return;

   check(to == get_self(), "recipient must be the contract");
   check(quantity.amount > 0, "invalid amount");

   registry _registry(get_self(), get_self().value);
   auto search_token = _registry.find(quantity.symbol.code().raw());
   auto idx = _registry.get_index<name("byxtoken")>();
   auto search_xerc20 = idx.lower_bound(quantity.symbol.code().raw());

   check(
      search_token != _registry.end() ||
      search_xerc20 != idx.end(),
      "token not registered"
   );

   string dest_chainid;
   string recipient;
   bytes userdata;

   extract_memo_args(get_self(), memo, dest_chainid, recipient, userdata);

   auto token = get_first_receiver();

   if (search_token != _registry.end()) {
      auto xerc20 = search_token->xerc20;


      // TODO: factor out
      check(search_token->token == token, "invalid first receiver");
      lockbox_singleton _lockbox(xerc20, xerc20.value);
      check(_lockbox.exists(), "lockbox not found for the specified token");

      auto lockbox = _lockbox.get();

      string empty_str = "";
      // Deposit
      print("\ntoken.transfer\n");
      action(
         permission_level{ get_self(), "active"_n },
         token,
         "transfer"_n,
         make_tuple(get_self(), lockbox, quantity, empty_str)
      ).send();

      // From this point we rely on the mint event
      // handler (adapter::onmint) to be notified by
      // the minting inline action from the lockbox
      // (recipient of the token::transfer above).
      // NOTE: this is due to the execution order
      // of inline actions estabilished by the eosio protocol
      // (i.e. notifications are execute BEFORE inline actions)
   } else if (search_xerc20 != idx.end()) {

      check(search_xerc20->xerc20 == token, "invalid first receiver");

      // TODO: call swap
   }


}
}