SRC = $(wildcard *.cpp)
TARGETS = $(SRC:.cpp=.wasm)

all: $(TARGETS)

%.wasm: %.cpp
	cdt-cpp -o $@ $<

%.abi: %.wasm
	cdt-cpp --abigen $@ $<

clean:
	rm -f *.abi *.wasm
