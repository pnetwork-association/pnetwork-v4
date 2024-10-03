#include "xerc20.token.hpp"

namespace eosio {

void xtoken::create( const name&   issuer,
                    const asset&  maximum_supply )
{

    require_auth( get_self() );

    auto sym = maximum_supply.symbol;
    check( maximum_supply.is_valid(), "invalid supply");
    check( maximum_supply.amount > 0, "max-supply must be positive");

    stats statstable( get_self(), sym.code().raw() );
    auto existing = statstable.find( sym.code().raw() );
    check( existing == statstable.end(), "token with symbol already exists" );

    statstable.emplace( get_self(), [&]( auto& s ) {
       s.supply.symbol = maximum_supply.symbol;
       s.max_supply    = maximum_supply;
       s.issuer        = issuer;
    });
}

void xtoken::mint( const name& caller, const name& to, const asset& quantity, const string& memo )
{
    require_auth(caller);
    auto sym = quantity.symbol;
    check( sym.is_valid(), "invalid symbol name" );
    check( memo.size() <= 256, "memo has more than 256 bytes" );

    stats statstable( get_self(), sym.code().raw() );
    auto existing = statstable.find( sym.code().raw() );
    check( existing != statstable.end(), "token with symbol does not exist, create token before issue" );
    const auto& st = *existing;

    lockbox_singleton _lockbox( get_self(), get_self().value );
    auto lockbox = _lockbox.get();
    bridges bridgestable( get_self(), get_self().value );
    auto idx = bridgestable.get_index<name("bysymbol")>();
    auto itr = idx.lower_bound( quantity.symbol.code().raw() );
    while ( itr != idx.end() && itr->account != caller ) { itr++; }

    check( itr != idx.end() || caller == lockbox, "only lockbox or supported bridge can mint" );

    if (caller != lockbox) {
      auto bridge = *itr;
      auto current_limit = minting_current_limit_of(bridge);
      check(quantity <= current_limit, "xerc20_assert: not hight enough limits");
      use_minter_limits(bridge, quantity);

      bridgestable.modify(*itr, same_payer, [&](auto& r) { r = bridge; });
    }

    require_auth( caller );
    check( quantity.is_valid(), "invalid quantity" );
    check( quantity.amount > 0, "must issue positive quantity" );
    check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );
    check( quantity.amount <= st.max_supply.amount - st.supply.amount, "quantity exceeds available supply");

    statstable.modify( st, same_payer, [&]( auto& s ) {
       s.supply += quantity;
    });

    add_balance( to, quantity, caller );

    require_recipient(to);
}

void xtoken::burn( const name& caller, const asset& quantity, const string& memo )
{
   require_auth(caller);
   auto sym = quantity.symbol;
   check( sym.is_valid(), "invalid symbol name" );
   check( memo.size() <= 256, "memo has more than 256 bytes" );

   stats statstable( get_self(), sym.code().raw() );
   auto existing = statstable.find( sym.code().raw() );
   check( existing != statstable.end(), "token with symbol does not exist" );
   const auto& st = *existing;

   lockbox_singleton _lockbox( get_self(), get_self().value );
   auto lockbox = _lockbox.get();
   bridges bridgestable( get_self(), get_self().value );
   auto idx = bridgestable.get_index<name("bysymbol")>();
   auto itr = idx.lower_bound( quantity.symbol.code().raw() );
   while ( itr != idx.end() && itr->account != caller ) { itr++; }

   check( itr != idx.end() || caller == lockbox, "only lockbox or supported bridge can mint" );

   if (caller != lockbox) {
      auto bridge = *itr;
      auto current_limit = burning_current_limit_of(bridge);
      check(quantity <= current_limit, "xerc20_assert: not hight enough limits");
      use_burner_limits(bridge, quantity);

      bridgestable.modify(*itr, same_payer, [&](auto& r) { r = bridge; });
   }

   require_auth( caller );
   check( quantity.is_valid(), "invalid quantity" );
   check( quantity.amount > 0, "must burn positive quantity" );

   check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );

   statstable.modify( st, same_payer, [&]( auto& s ) {
      s.supply -= quantity;
   });


   sub_balance( caller, quantity );

}


void xtoken::transfer( const name&    from,
                      const name&    to,
                      const asset&   quantity,
                      const string&  memo )
{
    check( from != to, "cannot transfer to self" );
    require_auth( from );
    check( is_account( to ), "to account does not exist");
    auto sym = quantity.symbol.code();
    stats statstable( get_self(), sym.raw() );
    const auto& st = statstable.get( sym.raw() );

    require_recipient( from );
    require_recipient( to );

    check( quantity.is_valid(), "invalid quantity" );
    check( quantity.amount > 0, "must transfer positive quantity" );
    check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );
    check( memo.size() <= 256, "memo has more than 256 bytes" );

    auto payer = has_auth( to ) ? to : from;

    sub_balance( from, quantity );

    add_balance( to, quantity, payer );
}

void xtoken::sub_balance( const name& owner, const asset& value ) {
   accounts from_acnts( get_self(), owner.value );

   const auto& from = from_acnts.get( value.symbol.code().raw(), "no balance object found" );
   check( from.balance.amount >= value.amount, "overdrawn balance" );

   from_acnts.modify( from, owner, [&]( auto& a ) {
         a.balance -= value;
      });
}

void xtoken::add_balance( const name& owner, const asset& value, const name& ram_payer )
{
   accounts to_acnts( get_self(), owner.value );
   auto to = to_acnts.find( value.symbol.code().raw() );
   if( to == to_acnts.end() ) {
      to_acnts.emplace( ram_payer, [&]( auto& a ){
        a.balance = value;
      });
   } else {
      to_acnts.modify( to, same_payer, [&]( auto& a ) {
        a.balance += value;
      });
   }

}

void xtoken::open( const name& owner, const symbol& symbol, const name& ram_payer )
{
   require_auth( ram_payer );

   check( is_account( owner ), "owner account does not exist" );

   auto sym_code_raw = symbol.code().raw();
   stats statstable( get_self(), sym_code_raw );
   const auto& st = statstable.get( sym_code_raw, "symbol does not exist" );
   check( st.supply.symbol == symbol, "symbol precision mismatch" );

   accounts acnts( get_self(), owner.value );
   auto it = acnts.find( sym_code_raw );
   if( it == acnts.end() ) {
      acnts.emplace( ram_payer, [&]( auto& a ){
        a.balance = asset{0, symbol};
      });
   }
}

void xtoken::close( const name& owner, const symbol& symbol )
{
   require_auth( owner );
   accounts acnts( get_self(), owner.value );
   auto it = acnts.find( symbol.code().raw() );
   check( it != acnts.end(), "Balance row already deleted or never existed. Action won't have any effect." );
   check( it->balance.amount == 0, "Cannot close because the balance is not zero." );
   acnts.erase( it );
}

void xtoken::setlockbox(const name& account) {
   require_auth(get_self());
   lockbox_singleton lockbox(get_self(), get_self().value);
   lockbox.set(account, get_self());
}

void xtoken::setlimits( const name& account, const asset& minting_limit, const asset& burning_limit ) {
   require_auth( get_self() );
   check( minting_limit.symbol == burning_limit.symbol, "minting and burning limits symbol does not match" );
   uint64_t symbol_code = minting_limit.symbol.code().raw();
   stats statstable( get_self(), symbol_code );
   auto existing_symbol = statstable.find( symbol_code );
   check( existing_symbol != statstable.end(), "token with symbol does not exist" );
   check( minting_limit.is_valid(), "invalid minting limit" );
   check( burning_limit.is_valid(), "invalid burning limit" );
   check( minting_limit.amount >= 0, "only non-negative limits allowed" );
   check( burning_limit.amount >= 0, "only non-negative limits allowed" );

   const auto& st = *existing_symbol;
   check( minting_limit.symbol == st.supply.symbol, "symbol precision mismatch");

   bridges bridgestable( get_self(), get_self().value );
   auto idx = bridgestable.get_index<name("bysymbol")>();
   auto itr = idx.lower_bound(symbol_code);
   while ( itr != idx.end() && itr->account != account ) { itr++; }

   bridge_model bridge = itr != idx.end() ? *itr : get_empty_bridge_model(account, minting_limit.symbol);
   change_minter_limit(bridge, minting_limit);
   change_burner_limit(bridge, burning_limit);

   if (itr == idx.end()) {
      // Insert a new bridge limits
      bridgestable.emplace(get_self(), [&](auto& row) {
         row = bridge;
      });
   } else {
      // Modify the existing bridge limits
      bridgestable.modify(*itr, same_payer, [&](auto& row) {
         row = bridge;
      });
   }
}

xtoken::bridge_model xtoken::get_empty_bridge_model(const name& account, const symbol& symbol) {
   asset zeroedAsset = asset(0, symbol);
   bridge_model b = {
      .account = account,
      .minting_timestamp = 0,
      .minting_rate = 0,
      .minting_current_limit = zeroedAsset,
      .minting_max_limit = zeroedAsset,
      .burning_timestamp = 0,
      .burning_rate = 0,
      .burning_current_limit = zeroedAsset,
      .burning_max_limit = zeroedAsset
   };
   return b;
}

asset xtoken::calculate_new_current_limit(const asset& limit, const asset& old_limit, const asset& current_limit) {
   uint64_t difference = 0;
   uint64_t new_current_limit = 0;
   if (old_limit.amount > limit.amount) {
      difference = old_limit.amount - limit.amount;
      new_current_limit = current_limit.amount > difference ? current_limit.amount - difference : 0;
   } else {
      difference = limit.amount - old_limit.amount;
      new_current_limit = current_limit.amount + difference;
   }

   return asset(new_current_limit, limit.symbol);
}

asset xtoken::get_current_limit(const asset& current_limit, const asset& max_limit, const uint64_t timestamp, const uint64_t rate_per_second) {
   asset limit = current_limit;

   uint64_t block_timestamp = current_block_time()
      .to_time_point()
      .sec_since_epoch();

   if (limit == max_limit) {
      limit = max_limit;
   } else if (timestamp + DURATION <= block_timestamp) {
      limit = max_limit;
   } else if (timestamp + DURATION > block_timestamp) {
      uint64_t time_passed = block_timestamp - timestamp;
      asset calculated_limit = limit + asset(time_passed * rate_per_second, limit.symbol);
      limit = calculated_limit > max_limit ? max_limit : calculated_limit;
   }

   return limit;
}

asset xtoken::minting_current_limit_of(bridge_model& bridge) {
   return get_current_limit(
      bridge.minting_current_limit,
      bridge.minting_max_limit,
      bridge.minting_timestamp,
      bridge.minting_rate
   );
}

asset xtoken::burning_current_limit_of(bridge_model& bridge) {
   return get_current_limit(
      bridge.burning_current_limit,
      bridge.burning_max_limit,
      bridge.burning_timestamp,
      bridge.burning_rate
   );
}

void xtoken::change_minter_limit(xtoken::bridge_model& bridge, const asset& limit) {
   asset old_limit = bridge.minting_max_limit;
   asset current_limit = minting_current_limit_of(bridge);
   bridge.minting_max_limit = limit;
   bridge.minting_current_limit = calculate_new_current_limit(limit, old_limit, current_limit);
   bridge.minting_rate = float(limit.amount) / DURATION;
   bridge.minting_timestamp = current_block_time().to_time_point().sec_since_epoch();
}

void xtoken::change_burner_limit(xtoken::bridge_model& bridge, const asset& limit) {
   asset old_limit = bridge.burning_max_limit;
   asset current_limit = burning_current_limit_of(bridge);
   bridge.burning_max_limit = limit;
   bridge.burning_current_limit = calculate_new_current_limit(limit, old_limit, current_limit);
   bridge.burning_rate = float(limit.amount) / DURATION;
   bridge.burning_timestamp = current_block_time().to_time_point().sec_since_epoch();
}

void xtoken::use_minter_limits(xtoken::bridge_model& bridge, const asset& change) {
   asset current_limit = minting_current_limit_of(bridge);
   bridge.minting_timestamp = current_block_time().to_time_point().sec_since_epoch();
   bridge.minting_current_limit = current_limit - change;
}

void xtoken::use_burner_limits(xtoken::bridge_model& bridge, const asset& change) {
   asset current_limit = burning_current_limit_of(bridge);
   bridge.burning_timestamp = current_block_time().to_time_point().sec_since_epoch();
   bridge.burning_current_limit = current_limit - change;
}
} /// namespace eosio

