CONTRACT=ptokens.token

all: $(CONTRACT).wasm $(CONTRACT).abi

check_defined = \
    $(strip $(foreach 1,$1, \
        $(call __check_defined,$1,$(strip $(value 2)))))
__check_defined = \
    $(if $(value $1),, \
      $(error Undefined $1$(if $2, ($2))))

%.wasm: %.cpp
	eosio-cpp -o $@ $<

%.abi: %.cpp
	eosio-abigen --output=$@ $<

clean:
	rm -f $(CONTRACT).abi $(CONTRACT).wasm
