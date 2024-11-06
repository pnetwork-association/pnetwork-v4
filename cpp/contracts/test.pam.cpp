#include "test.pam.hpp"

namespace eosio {

void testpam::setadapter(const name& adapter) {
   adapter_singleton _adapter(get_self(), get_self().value);
   _adapter.set(adapter, get_self());
}

void testpam::isauthorized(const operation& operation,const metadata& metadata) {
   adapter_singleton _adapter(get_self(), get_self().value);
   auto adapter = _adapter.get();

   checksum256 event_id;
   pam::check_authorization(adapter, operation, metadata, event_id);

   auto event_id_bytes = event_id.extract_as_byte_array();

   printhex(event_id_bytes.data(), event_id_bytes.size());
}

} // namespace eosio