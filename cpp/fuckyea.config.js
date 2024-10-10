module.exports = {
  networks: {
    local: {
      node_url: 'http://127.0.0.1:8888',
      accounts: [
        {
          name: 'test.account',
          permission: 'owner',
          private_key: process.env.PRIVATE_KEY,
        },
      ],
    },
  },
}
