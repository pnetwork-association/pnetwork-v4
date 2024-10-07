#include "test.receiver.hpp"

namespace eosio {
   void testreceiver::onreceive(const name& caller, const operation& operation, const metadata& metadata) {
      results _results(get_self(), get_self().value);

      auto itr = _results.end();
      auto id = itr == _results.begin() ? 0 : itr->id + 1;

      _results.emplace(get_self(), [&](auto& r) {
         r.id = id;
         r.data = operation.data;
      });
   }
}