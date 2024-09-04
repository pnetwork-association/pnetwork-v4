#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>

using namespace eosio;

CONTRACT lockbox : public contract {
    public:
        using contract::contract;

        TABLE storage_lockbox {
            name     XERC20;
            name     ERC20;
            bool     IS_NATIVE;

            uint64_t primary_key() const {
                return ERC20.value;
            }
        };

        // This is a table constructor which we will instantiate later
        using storage_table = eosio::multi_index<"storage"_n, storage_lockbox>;

        ACTION init( name xerc20, name erc20, bool is_native) {
            // check(!initialized, "Contract already initialized");
            name self = get_self();
            storage_table storage(self, self.value);

            storage.emplace(self, [&](auto& row) {
                row = storage_lockbox {
                    .XERC20 = xerc20,
                    .ERC20 = erc20,
                    .IS_NATIVE = is_native
                };
            });
        }

        [[eosio::on_notify("*::transfer")]]
        ACTION deposit(const asset& amount) {
            require_auth( get_self() );


        }
        // ACTION deposit_native() {}

        // ACTION deposit_to(address _user, uint256 _amount)
        // ACTION deposit_native_to(address _user)
        // ACTION withdraw(uint256 _amount)
        // ACTION withdraw_to(address _user, uint256 _amount)


        // Every ACTION you define can be called from outside the blockchain
        // ACTION newuser( name eos_account ){
        //     // Only the account calling this can add themselves
        //     require_auth(eos_account);

        //     // We're instantiating the user table
        //     user_table users(get_self(), get_self().value);

        //     // Finally, we're putting that user into the database
            // users.emplace(get_self(), [&](auto& row) {
            //     row = user {
            //         .eos_account = eos_account,
            //         .is_admin = 0
            //     };
            // });
        // }
};
