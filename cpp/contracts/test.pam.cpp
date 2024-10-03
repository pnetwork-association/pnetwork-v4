#include "test.pam.hpp"

namespace eosio {

   void testpam::isauthorized(const operation& operation,const metadata& metadata) {
      print("\nciao!\n");
      checksum256 event_id;
      pam::is_authorized(operation, metadata, event_id);

      auto id = event_id.extract_as_byte_array();

      print("\nevent_id\n");
      printhex(id.data(), id.size());
   }

}