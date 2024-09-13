### Design choices

- We stick to eosio.token interface for XERC20
- Issuing/retiring tokens had to be change in order to support multiple issuers
- New table (`bridges`) in order to map a set of issuers for a specific token
