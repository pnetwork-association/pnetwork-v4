SRC = $(wildcard *.cpp)
TARGETS = $(SRC:.cpp=.wasm)

all: $(TARGETS)

%.wasm: %.cpp
	eosio-cpp -o $@ $<

%.abi: %.wasm
	eosio-cpp --abigen $@ $<

clean:
	rm -f $(CONTRACT).abi $(CONTRACT).wasm
