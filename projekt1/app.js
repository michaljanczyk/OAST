const fs = require('fs');
const input_source = "./input.txt";


// parametry algorytmu
const table_length = 1000;
var seedrandom = require('seedrandom');
var randomize = seedrandom('oast');
var p = 0.5;
var p_cross = 0.3;
var p_mutate = 0.04;
const max_cross_number = 10000000;
const max_mutation_number = 500000;
const max_no_change_generations = 2500000;
const max_time = 15;
var cross_number = 0;
var mutation_number = 0;
var no_change_generations = 0;


var data_object = {
    "number_of_links": 0,
    "links": [],
    "number_of_demands": 0,
    "demands": []
};



fs.readFile(input_source, 'utf8', (err, data) => {
    if (err) throw err;

    data = data.split("\r\n");


    //Start of reading links
    data_object["number_of_links"] = data[0];

    for (var i = 1; i < data.length; i++) {

        if (data[i] == "-1") {
            break;
        }

        let link = data[i].split(" ");
        data_object.links[i - 1] = {};
        data_object.links[i - 1]["start_node_id"] = link[0];
        data_object.links[i - 1]["end_node_id"] = link[1];
        data_object.links[i - 1]["number_of_fibre_pairs_in_cable"] = link[2];
        data_object.links[i - 1]["fibre_pair_cost"] = link[3];
        data_object.links[i - 1]["number_of_lambdas_in_fibre"] = link[4];

    }

    //Start of reading demands
    i = i + 2;

    data_object["number_of_demands"] = data[i];
    i = i + 2;
    for (i, k = 0; i < data.length; i++, k++) {
        let demand = data[i].split(" ");
        data_object.demands[k] = {};
        data_object.demands[k]["start_node_id"] = demand[0];
        data_object.demands[k]["end_node_id"] = demand[1];
        data_object.demands[k]["demand_volume"] = demand[2];

        i++;
        data_object.demands[k]["number_of_demand_paths"] = data[i];
        i++;
        data_object.demands[k]["demand_path_list"] = [];


        for (var q = 0; q < data_object.demands[k]["number_of_demand_paths"]; i++, q++) {
            let demand_links = data[i].split(" ");
            data_object.demands[k]["demand_path_list"][q + 1] = [];
            data_object.demands[k]["demand_path_list"][q + 1]["id"] = demand_links.shift();
            demand_links.pop();
            data_object.demands[k]["demand_path_list"][q + 1]["links"] = demand_links;
        }


    }

    var result_table = create_table(data_object, table_length);


    solve("bruteforce", data_object, result_table);
    var start_time = new Date().getSeconds();
    var current_time = new Date().getSeconds();
    var old_F = 0;
    var best_F = 0;
    var trajectory = [];


    while ((current_time - start_time <= max_time) && (no_change_generations != max_no_change_generations) && (cross_number < max_cross_number) && (mutation_number < max_mutation_number)) {
        console.log("time: " + (current_time - start_time));

        var evolution_table = evolution(result_table);

        for (var element of evolution_table)
            result_table.push(element);



        [result_table, best_F] = solve("evolution", data_object, result_table);

        if (old_F == best_F){
          no_change_generations++;
          //console.log("no change:" + no_change_generations);
        }
        else {
            no_change_generations = 0;
        }

        old_F = best_F;
        console.log("F: " + best_F);
        //console.log("mutation_number: " + mutation_number);
      //  console.log("cross_number: " + cross_number);

        current_time = new Date().getSeconds();

        trajectory.push(best_F);


    }


    var link_comp = link_computation(data_object, result_table);
    create_solution_file(result_table[0], link_comp[0], link_comp[1]);
    create_trajectory_file(trajectory);

});

var link_computation = function(data_object, result_table) {
    var link_load = [];
    var link_capacity = [];
    var i = 0;
    for (var e = 1; e <= data_object.links.length; e++) {

        link_load[i] = 0;
        i++;
    }

    for (var d = 0; d < data_object.demands.length; d++) {
        var demand = data_object.demands[d];
        for (var p = 1; p < demand.demand_path_list.length; p++) {
            for (var e = 1; e <= data_object.links.length; e++) {
                var path = demand.demand_path_list[p];
                if (path.links.includes(e + '')) {
                    link_load[e - 1] += parseInt(result_table[d][p - 1]);
                }
            }
        }
    }

    for (var e = 0; e < data_object.links.length; e++) {

        link_capacity[e] = link_load[e];

    }
    // console.log(result_table);
    // console.log(link_capacity);
    return [link_capacity, link_load];


}

var create_table = function(data_object, number_of_tables) {

    var result_table = new Array();

    for (var i = 0; i < number_of_tables; i++) {
        result_table[i] = new Array();
        for (var d = 0; d < data_object.demands.length; d++) {
            result_table[i][d] = new Array();
            var demands = data_object.demands[d];
            var demand_volume = demands.demand_volume;

            var x = 0;
            for (var p = 0; p < demands.demand_path_list.length - 1; p++) {

                var random = Math.floor((randomize() * demand_volume) + 0.5);

                result_table[i][d][p] = 0;

                if (p == 0) {
                    result_table[i][d][p] = random;
                    x = x + random;
                } else {
                    if (p != (demands.demand_path_list.length - 2)) {
                        if (x >= demand_volume)
                            continue;
                        result_table[i][d][p] = (random - x >= 0) ? (random - x) : 0;
                        x = x + result_table[i][d][p];
                    } else {
                        if (x >= demand_volume)
                            continue;

                        result_table[i][d][p] = demand_volume - x;
                    }
                }
            }


        }

    }
    return result_table;
}


var solve = function(algorithm, data_object, input_table) {

    var F = new Array();
    var F_table_indexed = [];
    var result_table = new Array();

    for (const [index, table] of input_table.entries()) {

        var link_comp = link_computation(data_object, table);
        var link_comp_array = link_comp[0];
        var link_load_array = link_comp[1];
        var max_overload = new Array();

        //for(var e = 0; e < data_object.links.length; e++) {
        for (var l = 0; l < link_comp_array.length; l++) {
            //      console.log(link_comp_array[l]);

            max_overload.push(Math.max(0, link_comp_array[l] - data_object.links[l].number_of_lambdas_in_fibre * data_object.links[l].number_of_fibre_pairs_in_cable));

        }
        //  }

        F[index] = Math.max(...max_overload);

            console.log(F);
        if (algorithm == "bruteforce") {
            if (F[index] == 0) {
                create_solution_file(table, link_comp_array, link_load_array);
                return;
            }
        } else if (algorithm == "evolution") {


            F_table_indexed.push([F[index], index]);




            // if(F <= 5) {
            //   create_solution_file(table, link_comp_array, link_load_array);
            //   return;
            // }


        }


    }

    if (algorithm == "evolution") {
        F_table_indexed.sort(function(left, right) {
            return left[0] < right[0] ? -1 : 1;
        });


        for (var i = 0; i < table_length; i++) {
            //       console.log(F_table_indexed[i][1]);
            result_table.push(input_table[F_table_indexed[i][1]]);
        }
        //  console.log(result_table);
        // var link_comp = link_computation(data_object, result_table);
        // create_solution_file(result_table, link_comp[0], link_comp[1]);

    }
    //console.log(F_table_indexed);
    return [result_table, F_table_indexed[0][0]];
}

var create_solution_file = function(result_table, link_comp_array, link_load_array) {

    let writeStream = fs.createWriteStream('solution.txt');
    var output = '';

    //number_of_links
    writeStream.write(link_comp_array.length + "\n", 'utf8');

    //link_load_list
    for (var link_id = 0; link_id < link_comp_array.length; link_id++) {
        writeStream.write((link_id + 1) + " " + link_load_array[link_id] + " " + link_comp_array[link_id] + "\n", 'utf8');
    }

    //demand part
    writeStream.write("\n" + result_table.length + "\n", 'utf8');


    //demand flow list
    for (var demand_id = 0; demand_id < result_table.length; demand_id++) {
        writeStream.write((demand_id + 1) + " " + result_table[demand_id].length + "\n", 'utf8');

        for (var path_id = 0; path_id < result_table[demand_id].length; path_id++) {
            writeStream.write((path_id + 1) + " " + result_table[demand_id][path_id] + "\n", 'utf8');


        }
        writeStream.write("\n", 'utf8');

    }

    writeStream.on('finish', () => {
        console.log('wrote best solution to file');
    });
    writeStream.end();


}


var create_trajectory_file = function(fun_solution) {

    let writeStream = fs.createWriteStream('solution_trajectory.txt');


    //number_of_links

    for (var index in fun_solution) {
        writeStream.write(index + " " + fun_solution[index] + "\n", 'utf8');
    }

    writeStream.on('finish', () => {
        console.log('wrote solution trajectory to file');
    });
    writeStream.end();


}

var evolution = function(input_table) {
    var result_table = new Array();
    //  console.log(result_table[0][0]);
    var test_table = [];

    for (var element of input_table)
        test_table.push(element);

    input_table = shuffle(test_table);
    //    console.log(result_table[0][0]);
    var table1 = input_table.slice(0, input_table.length / 2 - 1);
    var table2 = input_table.slice(input_table.length / 2, input_table.length);





    for (var i = 0; i < table1.length; i++) {
        var rand = randomize();

        if (rand <= p_cross) {

            result_table.push(cross(table1[i], table2[i]));
        }

        if (rand <= p_mutate) {
            rand = randomize();
            if (rand <= p) {
                result_table.push(mutate(table1[i]));
            } else {
                result_table.push(mutate(table2[i]));
            }
        }

    }

    // console.log(result_table);
    return result_table;
}



var cross = function(table1, table2) {
    var p_path_cross = 0.5;
    rand = randomize();
    var table_result = new Array();

    for (var d = 0; d < table1.length; d++) {

        var path_1 = table1[d];
        var path_2 = table2[d];

        if (rand >= p_path_cross) {
            table_result[d] = path_1;
        } else {
            table_result[d] = path_2;
        }

    }
    //    console.log(table_result[0]);
    //    console.log("XXXXXXXXXXXXXXxx");
    cross_number++;
    return table_result;
}

var mutate = function(table) {
    var p_path_mutate = 0.5;

    var table_result = new Array();

    for (var d = 0; d < table.length; d++) {
        var rand = randomize();
        var path = table[d];

        if (rand <= p_path_mutate) {

            var test_path = [];

            for (var element of path)
                test_path.push(element);


            table_result[d] = shuffle(test_path);
        } else {
            table_result[d] = path;
        }

    }
    mutation_number++;
    return table_result;
}









function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(randomize() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function removeSmallest(arr) {
    var min = Math.min(...arr);
    return arr.filter(e => e != min);
}
