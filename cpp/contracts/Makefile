SRC = $(wildcard *.cpp)
TARGETS = $(SRC:.cpp=.wasm)

all: $(TARGETS)

%.wasm: %.cpp
	cdt-cpp -o $@ $<

clean:
	rm -f *.abi *.wasm
