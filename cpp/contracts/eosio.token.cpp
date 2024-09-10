#include "eosio.token.hpp"

namespace eosio {

void token::create( const name&   issuer,
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


void token::issue( const name& to, const asset& quantity, const string& memo )
{
    auto sym = quantity.symbol;
    check( sym.is_valid(), "invalid symbol name" );
    check( memo.size() <= 256, "memo has more than 256 bytes" );

    stats statstable( get_self(), sym.code().raw() );
    auto existing = statstable.find( sym.code().raw() );
    check( existing != statstable.end(), "token with symbol does not exist, create token before issue" );
    const auto& st = *existing;
    check( to == st.issuer, "tokens can only be issued to issuer account" );

    require_auth( st.issuer );
    check( quantity.is_valid(), "invalid quantity" );
    check( quantity.amount > 0, "must issue positive quantity" );

    check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );
    check( quantity.amount <= st.max_supply.amount - st.supply.amount, "quantity exceeds available supply");

    statstable.modify( st, same_payer, [&]( auto& s ) {
       s.supply += quantity;
    });

    add_balance( st.issuer, quantity, st.issuer );
}

void token::retire( const asset& quantity, const string& memo )
{
    auto sym = quantity.symbol;
    check( sym.is_valid(), "invalid symbol name" );
    check( memo.size() <= 256, "memo has more than 256 bytes" );

    stats statstable( get_self(), sym.code().raw() );
    auto existing = statstable.find( sym.code().raw() );
    check( existing != statstable.end(), "token with symbol does not exist" );
    const auto& st = *existing;

    require_auth( st.issuer );
    check( quantity.is_valid(), "invalid quantity" );
    check( quantity.amount > 0, "must retire positive quantity" );

    check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );

    statstable.modify( st, same_payer, [&]( auto& s ) {
       s.supply -= quantity;
    });

    sub_balance( st.issuer, quantity );
}

void token::transfer( const name&    from,
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

void token::sub_balance( const name& owner, const asset& value ) {
   accounts from_acnts( get_self(), owner.value );

   const auto& from = from_acnts.get( value.symbol.code().raw(), "no balance object found" );
   check( from.balance.amount >= value.amount, "overdrawn balance" );

   from_acnts.modify( from, owner, [&]( auto& a ) {
         a.balance -= value;
      });
}

void token::add_balance( const name& owner, const asset& value, const name& ram_payer )
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

void token::open( const name& owner, const symbol& symbol, const name& ram_payer )
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

void token::close( const name& owner, const symbol& symbol )
{
   require_auth( owner );
   accounts acnts( get_self(), owner.value );
   auto it = acnts.find( symbol.code().raw() );
   check( it != acnts.end(), "Balance row already deleted or never existed. Action won't have any effect." );
   check( it->balance.amount == 0, "Cannot close because the balance is not zero." );
   acnts.erase( it );
}

void token::mint( const name& issuer, const name& to, const asset& quantity, const string& memo )
{
   issue(issuer, quantity, "");
   transfer(issuer, to, quantity, memo);
}

void token::burn( const name& sender, const asset& quantity, const string& memo )
{
   auto sym = quantity.symbol;
   check( sym.is_valid(), "invalid symbol name" );
   check( memo.size() <= 256, "memo has more than 256 bytes" );

   stats statstable( get_self(), sym.code().raw() );
   auto existing = statstable.find( sym.code().raw() );
   check( existing != statstable.end(), "token with symbol does not exist" );
   const auto& st = *existing;

   require_auth( sender );
   check( quantity.is_valid(), "invalid quantity" );
   check( quantity.amount > 0, "must retire positive quantity" );

   check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );

   statstable.modify( st, same_payer, [&]( auto& s ) {
      s.supply -= quantity;
   });

   sub_balance( sender, quantity );
}

void token::setlimits( const name& bridge, const asset& minting_limit, const asset& burning_limit ) {
   require_auth( get_self() );
   check( minting_limit.symbol == burning_limit.symbol, "minting and burning limits symbol does not match" );
   uint64_t symbol_code = minting_limit.symbol.code().raw();
   stats statstable( get_self(), symbol_code );
   auto existing_symbol = statstable.find( symbol_code );
   check( existing_symbol != statstable.end(), "token with symbol does not exist" );
   check( minting_limit.is_valid(), "invalid minting limit" );
   check( burning_limit.is_valid(), "invalid burning limit" );

   // TODO(minging limit < max_supply)
   // TODO(burning limit < max_supply)

   bridges bridgestable( get_self(), get_self().value ); // contract scope
   auto idx = bridgestable.get_index<name("bysymbol")>();
   auto itr = idx.lower_bound(symbol_code);
   while ( itr != idx.end() && itr->account != bridge ) { itr++; }

   change_minter_limit<decltype(idx), decltype(itr)>(bridgestable, idx, itr, minting_limit);
}

asset token::calculate_new_current_limit(const asset& limit, const asset& old_limit, const asset& current_limit) {
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

asset token::get_current_limit(const asset& current_limit, const asset& max_limit, const block_timestamp timestamp, const uint64_t rate_per_second) {
   asset limit = current_limit;

   uint64_t block_ts = current_block_time()
      .to_time_point()
      .sec_since_epoch();
   uint64_t ts = timestamp
      .to_time_point()
      .sec_since_epoch();

   if (limit == max_limit) {
      limit = max_limit;
   } else if (ts + DURATION <= block_ts) {
      limit = max_limit;
   } else if (ts + DURATION > block_ts) {
      uint64_t time_passed = block_ts - ts;
      asset calculated_limit = limit + asset(time_passed * rate_per_second, limit.symbol);
      limit = calculated_limit > max_limit ? max_limit : calculated_limit;
   }

   return limit;
}

template <typename itrT>
asset token::minting_current_limit_of(const itrT& bridge) {
   return get_current_limit(
      bridge->minting_current_limit,
      bridge->minting_max_limit,
      bridge->minting_timestamp,
      bridge->minting_rate
   );
}

template <typename itrT>
asset token::burning_current_limit_of(const itrT& bridge) {
   return get_current_limit(
      bridge->burning_current_limit,
      bridge->burning_max_limit,
      bridge->burning_timestamp,
      bridge->burning_rate
   );
}

template <typename idxT, typename itrT>
void token::change_minter_limit(bridges& bridgestable, const idxT& index, const itrT& bridge, const asset& limit) {
   if (bridge == index.end()) {
      // New bridge's limits to set
      asset old_limit = asset(0, limit.symbol);
      asset current_limit = limit;
      bridgestable.emplace( get_self(), [&]( auto& r ) {
         r.minting_max_limit = limit;
         r.minting_current_limit = calculate_new_current_limit(limit, old_limit, current_limit);
         r.minting_rate = limit.amount / DURATION;
         r.minting_timestamp = current_block_time();
      });
   } else {
      // Bridge's limits set already
      asset old_limit = bridge->minting_max_limit;
      asset current_limit = minting_current_limit_of<decltype(bridge)>(bridge);
      bridgestable.modify( *bridge, same_payer, [&]( auto& r ) {
         r.minting_max_limit = limit;
         r.minting_current_limit = calculate_new_current_limit(limit, old_limit, current_limit);
         r.minting_rate = limit.amount / DURATION;
         r.minting_timestamp = current_block_time();
      });
   }
}

template <typename idxT, typename itrT>
void token::change_burner_limit(bridges& bridgestable, const idxT& index, const itrT& bridge, const asset& limit) {
   if (bridge == index.end()) {
      // New bridge's limits to set
      asset old_limit = asset(0, limit.symbol);
      asset current_limit = limit;
      bridgestable.emplace( get_self(), [&]( auto& r ) {
         r.burning_max_limit = limit;
         r.burning_current_limit = calculate_new_current_limit(limit, old_limit, current_limit);
         r.burning_rate = limit.amount / DURATION;
         r.burning_timestamp = current_block_time();
      });
   } else {
      // Bridge's limits set already
      asset old_limit = bridge->burning_max_limit;
      asset current_limit = burning_current_limit_of<decltype(bridge)>(bridge);
      bridgestable.modify( *bridge, same_payer, [&]( auto& r ) {
         r.burning_max_limit = limit;
         r.burning_current_limit = calculate_new_current_limit(limit, old_limit, current_limit);
         r.burning_rate = limit.amount / DURATION;
         r.burning_timestamp = current_block_time();
      });
   }
}
} /// namespace eosio

