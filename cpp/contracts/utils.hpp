#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/transaction.hpp>
#include "operation.hpp"
#include "metadata.hpp"

#include <string>

namespace eosio {
   using std::string;
   using std::vector;
   using bytes = std::vector<uint8_t>;

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
      const uint8_t exp = 18 - quantity.symbol.precision();
      return quantity.amount * powint(10, exp);
   }

   asset from_wei(uint128_t amount, const symbol& sym) {
      const uint8_t exp = 18 - sym.precision();
      return asset(amount / powint(10, exp), sym);
   }

   bytes extract_32bytes(const bytes& data, uint128_t offset) {
   bytes _data(data.begin() + offset, data.begin() + offset + 32);
   return _data;
   }

   signature convert_bytes_to_signature(const bytes& input_bytes) {
      check(input_bytes.size() == 65, "signature must be exactly 65 bytes");
      std::array<char, 65> sig_data;
      std::copy(input_bytes.begin(), input_bytes.end(), sig_data.begin());
      return signature(std::in_place_index<0>, sig_data);
   }

   uint64_t get_mappings_key(const bytes& chain_id) {
      eosio::check(chain_id.size() == 32, "chain ID must be 32 bytes long.");
      return (static_cast<uint64_t>(chain_id[24]) << 56) |
         (static_cast<uint64_t>(chain_id[25]) << 48) |
         (static_cast<uint64_t>(chain_id[26]) << 40) |
         (static_cast<uint64_t>(chain_id[27]) << 32) |
         (static_cast<uint64_t>(chain_id[28]) << 24) |
         (static_cast<uint64_t>(chain_id[29]) << 16) |
         (static_cast<uint64_t>(chain_id[30]) << 8)  |
         (static_cast<uint64_t>(chain_id[31]));
   }

   bool is_all_zeros(const bytes& emitter) {
      return std::all_of(emitter.begin(), emitter.end(), [](uint8_t byte) {
         return byte == 0x00;
      });
   }

   uint128_t bytes32_to_uint128(const bytes& data) {
      check(data.size() == 32, "input must be 32 bytes long.");
      // Check for overflow (first 16 bytes must be 0, bigger numbers not supported)
      for (size_t i = 0; i < 16; ++i) {
         if (data[i] != 0) {
               check(false, "number exceeds 128 bits.");
         }
      }

      uint128_t result = 0;
      for (size_t i = 16; i < 32; ++i) {
         result <<= 8;
         result |= data[i];
      }

      return result;
   }

   uint64_t bytes32_to_uint64(const bytes& data) {
      check(data.size() == 32, "The input must be 32 bytes long.");
      // Check for overflow (first 8 bytes must be 0, bigger numbers not supported)
      for (size_t i = 0; i < 8; ++i) {
         if (data[i] != 0) {
               check(false, "number exceeds 64 bits.");
         }
      }

      uint64_t result = 0;
      for (size_t i = 8; i < 32; ++i) {
         result <<= 8;
         result |= data[i];
      }

      return result;
   }

   checksum256 bytes32_to_checksum256(const bytes& data) {
      check(data.size() == 32, "input must be 32 bytes long.");
      std::array<uint8_t, 32> byte_array;
      std::copy(data.begin(), data.end(), byte_array.begin());
      return checksum256(byte_array);
   }

   name bytes_to_name(const bytes& data) {
      uint8_t length = std::min(static_cast<uint8_t>(data.size()), static_cast<uint8_t>(8));
      std::string name_str;
      for (uint8_t byte : data) {
         char eosio_char = static_cast<char>(byte);
         name_str += eosio_char;
      }
      name name_value(name_str);
      return name_value;
   }
}