#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

namespace eosio {
   TABLE adapter_past_events_table {
      uint64_t      notused;
      checksum256   event_id;

      uint64_t    primary_key()   const { return notused; }
      const checksum256& secondary_key() const { return event_id; }
   };

   constexpr name adapter_registry_idx_eventid = "byeventid"_n;

   typedef indexed_by<
      adapter_registry_idx_eventid,
      const_mem_fun<
         adapter_past_events_table,
         const checksum256&,
         &adapter_past_events_table::secondary_key
      >
   > adapter_past_events_byeventid;
}