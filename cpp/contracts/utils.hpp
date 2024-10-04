#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/transaction.hpp>

#include <string>

namespace eosio {
   using std::string;
   using std::vector;
   using bytes = std::vector<uint8_t>;
   using eosio::unpack;
   using eosio::read_transaction;
   using eosio::transaction_size;

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

   bytes hex_to_bytes(const string &hex) {
      bytes bytes;
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

   template<typename T>
   bytes to_bytes(T value, size_t size) {
      bytes vec(size, 0);

      size_t num_bytes = sizeof(T);
      check(num_bytes <= 32, "unable to convert to bytes32");

      for (size_t i = 0; i < num_bytes;i++) {
         T v = (value >> (i * 8)) & 0xFF;
         vec[size - i - 1] = static_cast<uint8_t>(v);
      }

      return vec;
   }

   template<typename T>
   bytes to_bytes32(T value) {
      return to_bytes<T>(value, 32);
   }


   // Ascii to hex convertion of the account name
   // Example:
   // to_bytes32("TKN") => 00000000000000000000000000000000000000000000000000000000004e4b54
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

   uint128_t powint(uint128_t x, uint8_t p)
   {
      if (p == 0) return 1;
      if (p == 1) return x;

      uint128_t tmp = powint(x, p/2);
      if (p % 2 == 0) return tmp * tmp;
      else return x * tmp * tmp;
   }

   uint128_t to_wei(asset quantity) {
      uint8_t exp = 18 - quantity.symbol.precision();
      auto power = powint(10, exp);
      uint128_t value = quantity.amount * power;
      return value;
   }

   asset from_wei(uint128_t amount, const symbol& sym) {
      uint128_t divisor = 1000000000000000000; // 1e18

      return asset(amount / divisor, sym);
   }
}